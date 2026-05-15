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
    const cookie = ensure_cookie(this.cookies);

    return retry_with_backoff(3, cookie, {
      do_attempt: async (current_cookie, is_last_attempt) => {
        const response = await do_tts_request(
          request.body_str,
          request.content_length,
          current_cookie,
        );
        const status = response.status;
        const response_ct = (response.headers['content-type'] as string | undefined) ?? '';

        if (status === 200 && !response_ct.includes('text/html')) {
          return build_speech_result(response, codec, sample_rate);
        }

        if (status === 429 || status === 500 || status === 503) {
          if (is_last_attempt) {
            throw provider_error(`returned ${status} after 3 retries`, 502);
          }
          return { retry: true };
        }

        throw provider_error(`returned HTTP ${status}: ${preview_body(response.rawBody)}`, 502);
      },
      pick_other_cookie: exclude => pick_other_cookie(this.cookies, exclude),
    });
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

function ensure_cookie(cookies: string[]): string {
  const cookie = pick_random(cookies);
  if (!cookie) {
    throw new OpenAiError(
      'No cookies configured for grok-console-tts. ' +
        'Add `providers.grok-console-tts.cookies` to config.json.',
      OPENAI_ERROR_TYPE.PROVIDER,
      null,
      OPENAI_ERROR_CODE.PROVIDER_UNAVAILABLE,
      502,
    );
  }
  return cookie;
}

function pick_other_cookie(cookies: string[], exclude: string): string {
  if (cookies.length <= 1) return exclude;
  const available = cookies.filter(c => c !== exclude);
  return pick_random(available) ?? exclude;
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

// -- Retry --

type AttemptResult = SpeechResult | { retry: true };

interface RetryConfig {
  do_attempt: (cookie: string, is_last_attempt: boolean) => Promise<AttemptResult>;
  pick_other_cookie: (exclude: string) => string;
}

async function retry_with_backoff(
  max_retries: number,
  initial_cookie: string,
  config: RetryConfig,
): Promise<SpeechResult> {
  let cookie = initial_cookie;

  for (let attempt = 0; attempt <= max_retries; attempt++) {
    if (attempt > 0) {
      await sleep(Math.pow(2, attempt) * 1000 + Math.random() * 500);
      cookie = config.pick_other_cookie(cookie);
    }

    try {
      const result = await config.do_attempt(cookie, attempt === max_retries);

      if (!('retry' in result)) {
        return result;
      }
    } catch (err) {
      if (err instanceof OpenAiError) throw err;

      if (attempt === max_retries) {
        throw provider_error(
          `request failed: ${err instanceof Error ? err.message : String(err)}`,
          502,
        );
      }
    }
  }

  throw provider_error('unexpected end of retry loop', 500);
}

// -- Error helpers --

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
