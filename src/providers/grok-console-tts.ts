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
import { OpenAiError } from '../errors.js';
import { OPENAI_ERROR_TYPE, OPENAI_ERROR_CODE } from '../types/openai.js';
import { tts_request_base } from '../types/schema.js';
import type { TtsProvider, SpeechParams, SpeechResult } from '../types/provider.js';

// -- Schema --

const grok_tts_schema = tts_request_base.extend({
  voice: z.string().optional(),
  codec: z.enum(['mp3', 'pcm', 'ulaw', 'opus']).optional(),
  language: z.string().optional(),
  sample_rate: z.number().int().positive().optional(),
  cookie: z.string().optional(),
});

// -- Constants --

const CONSOLE_BASE = 'https://console.x.ai';
const TTS_ENDPOINT = `${CONSOLE_BASE}/v1/tts`;

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

// -- Provider --

export class GrokTtsProvider implements TtsProvider {
  readonly name = 'grok-console-tts';
  readonly owned_by = 'x-ai';
  request_schema = grok_tts_schema;

  private cookies: string[];

  constructor(config?: Record<string, unknown>) {
    const raw = config?.cookies;
    if (Array.isArray(raw)) {
      this.cookies = raw.filter((c): c is string => typeof c === 'string' && c.length > 0);
    } else if (typeof raw === 'string') {
      this.cookies = [raw];
    } else {
      this.cookies = [];
    }
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
        const response = await do_tts_request(request.body_str, request.content_length, cookie);
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

        if (status === 429 || status === 500 || status === 503) {
          if (attempt >= max_retries) {
            throw provider_error(`returned ${status} after 3 retries`, 502);
          }
          await sleep(Math.pow(2, attempt + 1) * 1000 + Math.random() * 500);
          continue;
        }

        throw provider_error(`returned HTTP ${status}: ${preview_body(response.rawBody)}`, 502);
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

async function do_tts_request(
  body_str: string,
  content_length: string,
  cookie: string,
): Promise<CuimpResponse> {
  const headers: Record<string, string> = {
    ...BASE_HEADERS,
    cookie,
  };
  headers['content-length'] = content_length;

  const client = createCuimpHttp({
    descriptor: { browser: 'chrome', version: '146' },
  });

  return client.request({
    url: TTS_ENDPOINT,
    method: 'POST',
    headers,
    data: body_str,
    timeout: 30000,
  });
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
