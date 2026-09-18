/**
 * Grok Console TTS provider.
 * Uses cuimp to impersonate Chrome 146 TLS fingerprint and calls
 * the x.ai Console Playground TTS endpoint for speech synthesis.
 *
 * Supports 5 voices: eve, ara, rex, sal, leo
 * Supports codecs: mp3, pcm, ulaw, opus
 *
 * Configuration (config.json):
 *   `providers.grok-console-tts.cookies` - array of cookie strings
 *     Each cookie should include sso, sso-rw, __cf_bm values.
 *     Multiple cookies are rotated randomly with fallback on retry.
 *
 * Supported extra params:
 *   - voice (optional, default "eve"): eve, ara, rex, sal, leo
 *   - codec (optional, default "mp3"): mp3, pcm, ulaw, opus
 *   - language (optional, default "en"): language code
 *   - sample_rate (optional, default 24000): sample rate in Hz
 *   - cookie (optional): per-request cookie, bypasses config and auth rotation
 */

import { z } from 'zod';
import { createCuimpHttp } from 'cuimp';
import { createHash, randomBytes, webcrypto } from 'node:crypto';
import { OpenAiError, upstream_error_details } from '../errors.js';
import { OPENAI_ERROR_TYPE, OPENAI_ERROR_CODE } from '../types/openai.js';
import { tts_request_extended } from '../types/schema.js';
import type { TtsProvider, SpeechParams, SpeechResult } from '../types/provider.js';

// -- Schema --

const grok_tts_schema = tts_request_extended.extend({
  voice: z.string().optional(),
  codec: z.enum(['mp3', 'pcm', 'ulaw', 'opus']).optional(),
  language: z.string().optional(),
  sample_rate: z.number().int().positive().optional(),
  cookie: z.string().optional(),
});

// -- Constants --

const CONSOLE_BASE = 'https://console.x.ai';
const TTS_ENDPOINT = `${CONSOLE_BASE}/v1/tts`;
const DPOP_TOKEN_ENDPOINT = `${CONSOLE_BASE}/v1/dpop/token`;
const TTS_PAGE = `${CONSOLE_BASE}/playground/voice/text-to-speech`;

const GROK_VOICES = ['eve', 'ara', 'rex', 'sal', 'leo'] as const;

const GROK_MIME: Record<string, string> = {
  mp3: 'audio/mpeg',
  pcm: 'audio/L16; rate=24000; channels=1',
  ulaw: 'audio/basic',
  opus: 'audio/ogg; codecs=opus',
};

const BASE_HEADERS: Record<string, string> = {
  accept: '*/*',
  dnt: '1',
  origin: CONSOLE_BASE,
  priority: 'u=1, i',
  referer: `${CONSOLE_BASE}/playground/voice/text-to-speech?campaign=stt-tts-blog`,
};
BASE_HEADERS['accept-language'] = 'zh-CN,zh;q=0.9';
BASE_HEADERS['content-type'] = 'application/json';
BASE_HEADERS['sec-fetch-dest'] = 'empty';
BASE_HEADERS['sec-fetch-mode'] = 'cors';
BASE_HEADERS['sec-fetch-site'] = 'same-origin';
BASE_HEADERS['x-cluster'] = 'https://us-east-1.api.x.ai';

interface CuimpResponse {
  status: number;
  headers: Record<string, string | string[]>;
  // eslint-disable-next-line @typescript-eslint/naming-convention -- matches cuimp API shape
  rawBody: Buffer | Uint8Array;
}

interface RequestContext {
  cookie: string;
  browser_version: string;
  user_agent?: string;
  proxy?: string;
}

interface FlareSolverrCookie {
  name: string;
  value: string;
}

interface FlareSolverrResponse {
  status: string;
  message: string;
  solution?: {
    status: number;
    url: string;
    cookies: FlareSolverrCookie[];
    // eslint-disable-next-line @typescript-eslint/naming-convention -- FlareSolverr API shape
    userAgent: string;
  };
}

interface PublicJwk {
  kty: string;
  crv: string;
  x: string;
  y: string;
}

interface DpopSession {
  private_key: CryptoKey;
  public_jwk: PublicJwk;
  access_token: string;
  expires_at_ms: number;
}

// -- Provider --

export class GrokTtsProvider implements TtsProvider {
  readonly name = 'grok-console-tts';
  readonly owned_by = 'x-ai';
  request_schema = grok_tts_schema;

  private cookies: string[];
  private flaresolverr_url?: string;
  private flaresolverr_proxy?: string;
  private browser_version: string;
  private user_agent?: string;
  private proxy_url?: string;
  private dpop_sessions = new Map<string, DpopSession>();

  constructor(config?: Record<string, unknown>) {
    const raw = config?.cookies;
    if (Array.isArray(raw)) {
      this.cookies = raw.filter((c): c is string => typeof c === 'string' && c.length > 0);
    } else if (typeof raw === 'string') {
      this.cookies = [raw];
    } else {
      this.cookies = [];
    }

    this.flaresolverr_url =
      optional_string(config?.flaresolverr_url) ?? process.env['FLARESOLVERR_URL'];
    this.flaresolverr_proxy =
      optional_string(config?.flaresolverr_proxy) ?? process.env['FLARESOLVERR_PROXY'];
    this.browser_version =
      optional_string(config?.browser_version) ?? process.env['GROK_BROWSER_VERSION'] ?? '146';
    this.user_agent = optional_string(config?.user_agent);
    this.proxy_url = optional_string(config?.proxy);
  }

  get_models(): string[] {
    return ['grok-console-tts'];
  }

  get_model_voices(_model: string): string[] {
    return [...GROK_VOICES];
  }

  supports_model(model: string): boolean {
    return model === 'grok-console-tts';
  }

  async speak(params: SpeechParams): Promise<SpeechResult> {
    const voice = resolve_voice(params.extra['voice'] as string | undefined);
    const codec = (params.extra['codec'] as string | undefined) ?? 'mp3';
    const language = (params.extra['language'] as string | undefined) ?? 'en';
    const sample_rate = (params.extra['sample_rate'] as number | undefined) ?? 24000;

    const request = build_request_payload(params.input, voice, codec, language, sample_rate);

    const req_cookie = params.extra['cookie'] as string | undefined;
    const pool: string[] = req_cookie ? [req_cookie] : [...this.cookies];
    const max_retries = req_cookie ? 0 : 3;

    if (pool.length === 0) {
      throw no_credential_error(
        'No cookies configured for grok-console-tts. ' +
          'Add `providers.grok-console-tts.cookies` to config.json.',
      );
    }

    // Retry loop handles both rate-limit backoff and credential rotation
    let last_cookie: string | undefined;
    for (let attempt = 0; ; attempt++) {
      if (pool.length === 0) {
        throw provider_error('authentication failed: all cookies rejected (401)', 502);
      }

      const cookie =
        attempt === 0 ? pool[0] : (pick_random(pool.filter(c => c !== last_cookie)) ?? pool[0]);
      last_cookie = cookie;

      try {
        const response = await this.perform_tts_request(
          request.body_str,
          request.content_length,
          cookie,
        );
        const status = response.status;
        const response_ct = (response.headers['content-type'] as string | undefined) ?? '';

        if (status === 200 && !response_ct.includes('text/html')) {
          return build_speech_result(response, codec, sample_rate);
        }

        if (status === 401) {
          const idx = pool.indexOf(cookie);
          if (idx >= 0) pool.splice(idx, 1);
          // Continue loop immediately (no backoff) to try next credential
          if (pool.length === 0) {
            throw provider_error('authentication failed: all cookies rejected (401)', 502);
          }
          continue;
        }

        if (status === 429 || status >= 500) {
          if (attempt >= max_retries) {
            throw upstream_error(status, response.rawBody);
          }
          await sleep(Math.pow(2, attempt + 1) * 1000 + Math.random() * 500);
          continue;
        }

        throw upstream_error(status, response.rawBody);
      } catch (err) {
        if (err instanceof OpenAiError) {
          // Let AuthCredentialError from 401 removal below propagate to caller
          // Re-throw non-auth OpenAiErrors
          throw err;
        }
        // Network errors: retry with backoff
        if (attempt >= max_retries) {
          throw provider_error(
            `request failed: ${err instanceof Error ? err.message : String(err)}`,
            502,
          );
        }
        await sleep(Math.pow(2, attempt + 1) * 1000 + Math.random() * 500);
      }
    }
  }

  private create_context(cookie: string): RequestContext {
    return {
      cookie,
      browser_version: this.browser_version,
      user_agent: this.user_agent,
      proxy:
        this.flaresolverr_proxy && cookie.includes('cf_clearance')
          ? this.flaresolverr_proxy
          : this.proxy_url,
    };
  }

  private async perform_tts_request(
    body_str: string,
    content_length: string,
    cookie: string,
  ): Promise<CuimpResponse> {
    const context = this.create_context(cookie);
    let session = this.get_cached_dpop_session(context);
    let cloudflare_retried = false;
    let dpop_retried = false;
    let response: CuimpResponse | undefined;

    for (let step = 0; step < 5; step++) {
      const auth_headers = session ? await build_dpop_headers(session, TTS_ENDPOINT) : {};
      response = await do_console_request(
        TTS_ENDPOINT,
        body_str,
        content_length,
        context,
        auth_headers,
      );

      if (response.status === 200 && !is_html_response(response)) {
        return response;
      }

      if (is_cloudflare_response(response)) {
        if (cloudflare_retried) {
          throw provider_error('Cloudflare challenge persisted after FlareSolverr retry', 502);
        }
        await this.solve_cloudflare(context);
        cloudflare_retried = true;
        continue;
      }

      if (is_dpop_required_response(response)) {
        if (dpop_retried) {
          throw provider_error('DPoP authentication failed after retry', 502);
        }
        this.dpop_sessions.delete(dpop_session_key(context));
        session = await this.get_dpop_session(context);
        dpop_retried = true;
        continue;
      }

      return response;
    }

    throw provider_error(
      response
        ? `returned HTTP ${response.status}: ${preview_body(response.rawBody)}`
        : 'request retry loop failed',
      502,
    );
  }

  private async get_dpop_session(context: RequestContext): Promise<DpopSession> {
    const cached = this.get_cached_dpop_session(context);
    if (cached) return cached;

    const key_pair = await webcrypto.subtle.generateKey(
      {
        name: 'ECDSA',
        // eslint-disable-next-line @typescript-eslint/naming-convention -- Web Crypto API shape
        namedCurve: 'P-256',
      },
      true,
      ['sign', 'verify'],
    );
    const public_jwk = (await webcrypto.subtle.exportKey(
      'jwk',
      key_pair.publicKey,
    )) as unknown as PublicJwk;
    const mint_body = JSON.stringify({
      jwk: {
        kty: public_jwk.kty,
        crv: public_jwk.crv,
        x: public_jwk.x,
        y: public_jwk.y,
      },
    });
    let response = await do_console_request(
      DPOP_TOKEN_ENDPOINT,
      mint_body,
      String(Buffer.byteLength(mint_body, 'utf-8')),
      context,
    );

    if (is_cloudflare_response(response)) {
      await this.solve_cloudflare(context);
      response = await do_console_request(
        DPOP_TOKEN_ENDPOINT,
        mint_body,
        String(Buffer.byteLength(mint_body, 'utf-8')),
        context,
      );
    }

    if (response.status !== 200) {
      throw provider_error(
        `DPoP token mint returned HTTP ${response.status}: ${preview_body(response.rawBody)}`,
        502,
      );
    }

    const minted = parse_json<{ access_token?: string; expires_in?: number }>(response.rawBody);
    if (
      !minted?.access_token ||
      typeof minted.expires_in !== 'number' ||
      !Number.isFinite(minted.expires_in)
    ) {
      throw provider_error('DPoP token mint returned an invalid response', 502);
    }

    const public_key = {
      kty: public_jwk.kty,
      crv: public_jwk.crv,
      x: public_jwk.x,
      y: public_jwk.y,
    };
    const session: DpopSession = {
      private_key: key_pair.privateKey,
      public_jwk: public_key,
      access_token: minted.access_token,
      expires_at_ms: Date.now() + minted.expires_in * 1000,
    };
    this.dpop_sessions.set(dpop_session_key(context), session);
    return session;
  }

  private get_cached_dpop_session(context: RequestContext): DpopSession | undefined {
    const cached = this.dpop_sessions.get(dpop_session_key(context));
    return cached && cached.expires_at_ms > Date.now() + 30_000 ? cached : undefined;
  }

  private async solve_cloudflare(context: RequestContext): Promise<void> {
    if (!this.flaresolverr_url) {
      throw provider_error(
        'Cloudflare challenge detected; configure flaresolverr_url to solve it',
        502,
      );
    }

    const payload: Record<string, unknown> = {
      cmd: 'request.get',
      url: TTS_PAGE,
      cookies: parse_cookie_header(context.cookie),
    };
    payload['maxTimeout'] = 60_000;
    payload['returnOnlyCookies'] = true;
    payload['disableMedia'] = true;
    const solve_proxy = this.flaresolverr_proxy ?? this.proxy_url;
    if (solve_proxy) {
      payload['proxy'] = { url: solve_proxy };
    }

    let response: Response;
    try {
      response = await fetch(this.flaresolverr_url, {
        method: 'POST',
        headers: { ['content-type']: 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(75_000),
      });
    } catch (err) {
      throw provider_error(
        `FlareSolverr request failed: ${err instanceof Error ? err.message : String(err)}`,
        502,
      );
    }

    if (!response.ok) {
      throw provider_error(`FlareSolverr returned HTTP ${response.status}`, 502);
    }

    const solved = (await response.json()) as FlareSolverrResponse;
    if (solved.status !== 'ok' || !solved.solution) {
      throw provider_error(`FlareSolverr failed: ${solved.message || 'invalid response'}`, 502);
    }

    const cookie_header = solved.solution.cookies
      .filter(cookie => cookie.name && cookie.value)
      .map(cookie => `${cookie.name}=${cookie.value}`)
      .join('; ');
    if (!cookie_header) {
      throw provider_error('FlareSolverr returned no cookies', 502);
    }

    context.cookie = cookie_header;
    context.user_agent = solved.solution.userAgent;
    context.browser_version = browser_version_from_user_agent(solved.solution.userAgent);
    context.proxy = solve_proxy;
  }
}

// -- Request building --

function resolve_voice(voice: string | undefined): string {
  return voice ?? 'eve';
}

function build_request_payload(
  text: string,
  voice: string,
  codec: string,
  language: string,
  sample_rate: number,
): { body_str: string; content_length: string } {
  const body: Record<string, unknown> = {
    text,
    voice_id: voice,
    language,
    text_normalization: true,
  };

  if (codec !== 'mp3' || sample_rate !== 24000) {
    body['output_format'] = { codec, sample_rate };
  }

  const body_str = JSON.stringify(body);
  const content_length = String(Buffer.byteLength(body_str, 'utf-8'));
  return { body_str, content_length };
}

// -- HTTP --

async function do_console_request(
  url: string,
  body_str: string,
  content_length: string,
  context: RequestContext,
  extra_headers: Record<string, string> = {},
): Promise<CuimpResponse> {
  const version = context.browser_version;
  const platform = context.user_agent?.includes('Linux') ? 'Linux' : 'Windows';
  const headers: Record<string, string> = {
    ...BASE_HEADERS,
    authorization: extra_headers['authorization'] ?? '',
    cookie: context.cookie,
    dpop: extra_headers['dpop'] ?? '',
  };
  delete_empty_headers(headers);
  headers['content-length'] = content_length;
  headers['sec-ch-ua'] =
    `"Chromium";v="${version}", "Not-A.Brand";v="24", "Google Chrome";v="${version}"`;
  headers['sec-ch-ua-mobile'] = '?0';
  headers['sec-ch-ua-platform'] = `"${platform}"`;
  if (context.user_agent) headers['user-agent'] = context.user_agent;

  const client = createCuimpHttp({
    descriptor: { browser: 'chrome', version },
  });

  return client.request({
    url,
    method: 'POST',
    headers,
    data: body_str,
    timeout: 30000,
    ...(context.proxy ? { proxy: context.proxy } : {}),
  });
}

async function build_dpop_headers(
  session: DpopSession,
  endpoint: string,
): Promise<Record<string, string>> {
  const token_hash = base64url(createHash('sha256').update(session.access_token).digest());
  const header = base64url(
    Buffer.from(
      JSON.stringify({
        typ: 'dpop+jwt',
        alg: 'ES256',
        jwk: session.public_jwk,
      }),
    ),
  );
  const payload = base64url(
    Buffer.from(
      JSON.stringify({
        jti: randomBytes(16).toString('base64url'),
        htm: 'POST',
        htu: endpoint,
        iat: Math.floor(Date.now() / 1000),
        ath: token_hash,
      }),
    ),
  );
  const signature = await webcrypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    session.private_key,
    Buffer.from(`${header}.${payload}`),
  );

  return {
    authorization: `DPoP ${session.access_token}`,
    dpop: `${header}.${payload}.${base64url(Buffer.from(signature))}`,
  };
}

function is_cloudflare_response(response: CuimpResponse): boolean {
  if (response.status !== 403 && response.status !== 503) return false;
  const content_type = response_content_type(response);
  if (content_type.includes('text/html')) return true;
  const body = preview_body(response.rawBody).toLowerCase();
  return body.includes('<!doctype html') || body.includes('cloudflare');
}

function is_dpop_required_response(response: CuimpResponse): boolean {
  if (response.status !== 401 && response.status !== 403) return false;
  return preview_body(response.rawBody).includes('unauthorized:dpop-required');
}

function is_html_response(response: CuimpResponse): boolean {
  return response_content_type(response).includes('text/html');
}

function response_content_type(response: CuimpResponse): string {
  const value = response.headers['content-type'];
  return (Array.isArray(value) ? value[0] : value)?.toLowerCase() ?? '';
}

function parse_json<T>(body: Buffer | Uint8Array): T | undefined {
  try {
    return JSON.parse(Buffer.from(body).toString('utf-8')) as T;
  } catch {
    return undefined;
  }
}

function parse_cookie_header(cookie: string): FlareSolverrCookie[] {
  return cookie
    .split(';')
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => {
      const separator = part.indexOf('=');
      return separator < 0
        ? { name: part, value: '' }
        : { name: part.slice(0, separator), value: part.slice(separator + 1) };
    })
    .filter(cookie_pair => cookie_pair.name.length > 0);
}

function browser_version_from_user_agent(user_agent: string): string {
  return user_agent.match(/Chrome\/(\d+)/)?.[1] ?? '146';
}

function dpop_session_key(context: RequestContext): string {
  return createHash('sha256')
    .update(`${context.cookie}\n${context.user_agent ?? ''}\n${context.proxy ?? ''}`)
    .digest('hex');
}

function base64url(value: Buffer | Uint8Array): string {
  return Buffer.from(value).toString('base64url');
}

function delete_empty_headers(headers: Record<string, string>): void {
  for (const [key, value] of Object.entries(headers)) {
    if (value === '') delete headers[key];
  }
}

function optional_string(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

// -- Response handling --

function build_speech_result(
  response: CuimpResponse,
  codec: string,
  sample_rate: number,
): SpeechResult {
  const response_ct = (response.headers['content-type'] as string | undefined) ?? '';
  const effective_codec = sniff_codec(response_ct, codec);

  const mime =
    effective_codec === 'pcm'
      ? `audio/L16; rate=${sample_rate}; channels=1`
      : (GROK_MIME[effective_codec] ?? 'audio/mpeg');

  return {
    content_type: mime,
    data: Buffer.from(response.rawBody),
  };
}

// -- Error helpers --

function no_credential_error(message?: string): OpenAiError {
  return new OpenAiError(
    message ?? 'No valid cookies configured for grok-console-tts.',
    OPENAI_ERROR_TYPE.PROVIDER,
    null,
    OPENAI_ERROR_CODE.PROVIDER_UNAVAILABLE,
    502,
  );
}

function provider_error(message: string, status_code: number): OpenAiError {
  return new OpenAiError(
    `grok-console-tts ${message}`,
    OPENAI_ERROR_TYPE.PROVIDER,
    null,
    OPENAI_ERROR_CODE.PROVIDER_UNAVAILABLE,
    status_code,
  );
}

function upstream_error(status: number, body: Buffer | Uint8Array): OpenAiError {
  const type =
    status === 401
      ? OPENAI_ERROR_TYPE.AUTHENTICATION
      : status === 429
        ? OPENAI_ERROR_TYPE.RATE_LIMIT
        : status >= 500
          ? OPENAI_ERROR_TYPE.SERVER
          : OPENAI_ERROR_TYPE.INVALID_REQUEST;
  const details = upstream_error_details(body);
  const detail = details.message ?? details.raw;
  return new OpenAiError(
    `grok-console-tts returned HTTP ${status}${detail ? `: ${detail}` : ''}`,
    type,
    details.param,
    details.code,
    status,
  );
}

function preview_body(body: Buffer | Uint8Array | undefined): string {
  if (!body) return '';
  return Buffer.from(body).toString('utf-8').slice(0, 300);
}

// -- General helpers --

function pick_random<T>(items: T[]): T | undefined {
  if (items.length === 0) return undefined;
  return items[Math.floor(Math.random() * items.length)];
}

function sniff_codec(response_ct: string, fallback: string): string {
  if (response_ct.includes('mpeg')) return 'mp3';
  if (response_ct.includes('pcm') || response_ct.includes('L16')) return 'pcm';
  if (response_ct.includes('ulaw') || response_ct.includes('basic')) return 'ulaw';
  if (response_ct.includes('opus')) return 'opus';
  return fallback;
}

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
