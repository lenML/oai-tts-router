/**
 * OpenAI.fm TTS provider.
 * Uses cuimp to mimic Chrome 124 TLS fingerprint (bypasses openai.fm JA3 detection)
 * and calls https://www.openai.fm/api/generate to synthesize speech.
 *
 * openai.fm supports the same 11 voice names as the OpenAI TTS API but only
 * WAV and MP3 output formats (defaults to WAV).
 *
 * Environment variables:
 *   - `OPENAI_FM_BASE_URL` (default: https://www.openai.fm)
 *
 * Supported extra params:
 *   - `voice` (required): one of the 11 OpenAI voice names
 *   - `response_format`: 'wav' | 'mp3' (default 'wav')
 *   - `instructions`: optional voice instructions (mapped to `prompt` in the API)
 */

import { z } from 'zod';
import crypto from 'node:crypto';
import { createCuimpHttp } from 'cuimp';
import { OpenAiError, upstream_error_details } from '../errors.js';
import { OPENAI_ERROR_TYPE, OPENAI_ERROR_CODE } from '../types/openai.js';
import { tts_request_extended } from '../types/schema.js';
import type { TtsProvider, SpeechParams, SpeechResult } from '../types/provider.js';

// ── Schema ───────────────────────────────────────────────────

const openai_fm_schema = tts_request_extended.extend({
  voice: z.string().min(1, { message: 'The `voice` parameter is required.' }),
  response_format: z.enum(['wav', 'mp3']).optional(),
  speed: z.number().min(0.25).max(4.0).optional(),
  instructions: z.string().optional(),
});

// ── Constants ────────────────────────────────────────────────

const BROWSER_HEADERS: Record<string, string> = {};
BROWSER_HEADERS['sec-ch-ua'] = '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"';
BROWSER_HEADERS['sec-ch-ua-mobile'] = '?0';
BROWSER_HEADERS['sec-ch-ua-platform'] = '"macOS"';
BROWSER_HEADERS['Upgrade-Insecure-Requests'] = '1';
BROWSER_HEADERS['Accept'] =
  'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7';
BROWSER_HEADERS['Accept-Language'] = 'en-US,en;q=0.9';
BROWSER_HEADERS['User-Agent'] =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
BROWSER_HEADERS['Sec-Fetch-Site'] = 'none';
BROWSER_HEADERS['Sec-Fetch-Mode'] = 'navigate';
BROWSER_HEADERS['Sec-Fetch-User'] = '?1';
BROWSER_HEADERS['Sec-Fetch-Dest'] = 'document';
BROWSER_HEADERS['Priority'] = 'u=0, i';
BROWSER_HEADERS['DNT'] = '1';
BROWSER_HEADERS['Cache-Control'] = 'no-cache';
BROWSER_HEADERS['Pragma'] = 'no-cache';

const OPENAI_FM_VOICES = [
  'alloy',
  'ash',
  'ballad',
  'coral',
  'echo',
  'fable',
  'nova',
  'onyx',
  'sage',
  'shimmer',
  'verse',
] as const;

const DEFAULT_BASE_URL = 'https://www.openai.fm';

const FM_FORMAT_TO_MIME: Record<string, string> = {
  wav: 'audio/wav',
  mp3: 'audio/mpeg',
};

export class OpenaiFmProvider implements TtsProvider {
  readonly name = 'openai-fm';
  readonly owned_by = 'openai-fm';
  request_schema = openai_fm_schema;

  private base_url: string;

  constructor(config?: Record<string, unknown>) {
    this.base_url = (config?.base_url as string | undefined) ?? DEFAULT_BASE_URL;
  }

  get_models(): string[] {
    return ['openai-fm-tts'];
  }

  get_model_voices(_model: string): string[] {
    return [...OPENAI_FM_VOICES];
  }

  supports_model(model: string): boolean {
    return model === 'openai-fm-tts';
  }

  async speak(params: SpeechParams): Promise<SpeechResult> {
    // Bypass inherited proxy environment variables for this request only.
    const client = createCuimpHttp({
      descriptor: { browser: 'chrome', version: '124' },
    });

    const text = params.input;
    const voice = params.extra['voice'] as string | undefined;
    if (!voice) {
      throw new OpenAiError(
        'The `voice` parameter is required.',
        OPENAI_ERROR_TYPE.INVALID_REQUEST,
        'voice',
        null,
        400,
      );
    }

    if (!OPENAI_FM_VOICES.includes(voice as (typeof OPENAI_FM_VOICES)[number])) {
      throw new OpenAiError(
        `Unsupported voice '${voice}'. Supported: ${OPENAI_FM_VOICES.join(', ')}`,
        OPENAI_ERROR_TYPE.INVALID_REQUEST,
        'voice',
        OPENAI_ERROR_CODE.VOICE_NOT_SUPPORTED,
        400,
      );
    }

    const response_format = (params.extra['response_format'] as string | undefined) ?? 'wav';
    const fm_format = response_format === 'mp3' ? 'mp3' : 'wav';
    const instructions = params.extra['instructions'] as string | undefined;
    const speed = params.extra['speed'] as number | undefined;

    const form_body = new URLSearchParams({
      input: text,
      voice,
      generation: crypto.randomUUID(),
      response_format: fm_format,
    });
    if (instructions) form_body.append('prompt', instructions);
    if (speed !== undefined) form_body.append('speed', String(speed));

    const url = `${this.base_url.replace(/\/+$/, '')}/api/generate`;
    const headers: Record<string, string> = { ...BROWSER_HEADERS };
    headers['Content-Type'] = 'application/x-www-form-urlencoded';

    const max_retries = 3;
    for (let attempt = 0; attempt <= max_retries; attempt++) {
      if (attempt > 0) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1) + Math.random() * 500, 10000);
        await sleep(delay);
      }

      try {
        const response = await client.request({
          url,
          data: form_body.toString(),
          method: 'POST',
          headers,
          proxy: '',
        });
        const status = response.status;

        if (status === 200) {
          const content_type = response.headers['content-type'] ?? '';
          const detected_format = detect_fm_format(response.rawBody, content_type, fm_format);
          return {
            content_type: FM_FORMAT_TO_MIME[detected_format],
            data: Buffer.from(response.rawBody),
          };
        }

        if (status === 429 || status >= 500) {
          if (attempt === max_retries) {
            throw upstream_error(status, response.rawBody);
          }
          continue;
        }

        throw upstream_error(status, response.rawBody);
      } catch (err) {
        if (err instanceof OpenAiError) throw err;
        const message = err instanceof Error ? err.message : String(err);
        if (attempt === max_retries) {
          throw new OpenAiError(
            `openai.fm request failed: ${message}`,
            OPENAI_ERROR_TYPE.PROVIDER,
            null,
            OPENAI_ERROR_CODE.PROVIDER_UNAVAILABLE,
            502,
          );
        }
      }
    }

    throw new OpenAiError(
      'Unexpected end of retry loop in openai-fm provider',
      OPENAI_ERROR_TYPE.PROVIDER,
      null,
      OPENAI_ERROR_CODE.PROVIDER_UNAVAILABLE,
      500,
    );
  }
}
// ── Helpers ───────────────────────────────────────────────────

function detect_fm_format(
  body: Buffer | Uint8Array,
  content_type: string,
  fallback: string,
): string {
  const data = Buffer.from(body);
  const media_type = content_type.toLowerCase();
  if (
    media_type.includes('mpeg') ||
    data.subarray(0, 3).toString('ascii') === 'ID3' ||
    (data.length >= 2 && data[0] === 0xff && (data[1] & 0xe0) === 0xe0)
  ) {
    return 'mp3';
  }
  if (media_type.includes('wav') || data.subarray(0, 4).toString('ascii') === 'RIFF') {
    return 'wav';
  }
  return fallback;
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
    `openai.fm returned HTTP ${status}${detail ? `: ${detail}` : ''}`,
    type,
    details.param,
    details.code,
    status,
  );
}

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
