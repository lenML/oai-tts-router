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
import { OpenAiError } from '../errors.js';
import { OPENAI_ERROR_TYPE, OPENAI_ERROR_CODE } from '../types/openai.js';
import { tts_request_base } from '../types/schema.js';
import type { TtsProvider, SpeechParams, SpeechResult } from '../types/provider.js';

// ── Schema ───────────────────────────────────────────────────

const openai_fm_schema = tts_request_base.extend({
  voice: z.string().min(1, { message: 'The `voice` parameter is required.' }),
  response_format: z.enum(['wav', 'mp3']).optional(),
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
    // Bypass proxy for openai.fm requests — cuimp uses system curl which inherits
    // HTTP_PROXY/HTTPS_PROXY from dotenv, and proxied requests trigger 429 rate limiting
    // due to proxy IP reputation or JA3 interference.
    const prev_http = process.env['HTTP_PROXY'];
    const prev_https = process.env['HTTPS_PROXY'];
    delete process.env['HTTP_PROXY'];
    delete process.env['HTTPS_PROXY'];

    try {
      // Create a fresh cuimp client per speak() call, matching the demo pattern.
      // Reusing clients can cause header duplication with cuimp's .bat fallback.
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

      // Resolve format: openai.fm only supports wav and mp3
      const response_format = (params.extra['response_format'] as string | undefined) ?? 'wav';
      const fm_format = response_format === 'mp3' ? 'mp3' : 'wav';

      const instructions = params.extra['instructions'] as string | undefined;

      // Build form body
      const form_body = new URLSearchParams({
        input: text,
        voice: voice,
        generation: crypto.randomUUID(),
        response_format: fm_format,
      });

      if (instructions) {
        form_body.append('prompt', instructions);
      }

      const base_url = process.env['OPENAI_FM_BASE_URL'] ?? DEFAULT_BASE_URL;
      const url = `${base_url.replace(/\/+$/, '')}/api/generate`;

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
          });

          const status = response.status;

          if (status === 200) {
            // Detect actual format from Content-Type
            const content_type = (response.headers['content-type'] as string | undefined) ?? '';
            const detected_format = content_type.includes('mpeg') ? 'mp3' : fm_format;

            return {
              content_type: FM_FORMAT_TO_MIME[detected_format] ?? FM_FORMAT_TO_MIME[fm_format],
              data: Buffer.from(response.rawBody),
            };
          }

          // Retry on rate-limit or server errors
          if (status === 429 || status >= 500) {
            if (attempt === max_retries) {
              throw new OpenAiError(
                `openai.fm returned ${status} after ${max_retries} retries`,
                OPENAI_ERROR_TYPE.PROVIDER,
                null,
                OPENAI_ERROR_CODE.PROVIDER_UNAVAILABLE,
                502,
              );
            }
            continue;
          }

          throw new OpenAiError(
            `openai.fm returned HTTP ${status}`,
            OPENAI_ERROR_TYPE.PROVIDER,
            null,
            OPENAI_ERROR_CODE.PROVIDER_UNAVAILABLE,
            502,
          );
        } catch (err) {
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
          // Otherwise retry after delay
          continue;
        }
      }

      throw new OpenAiError(
        'Unexpected end of retry loop in openai-fm provider',
        OPENAI_ERROR_TYPE.PROVIDER,
        null,
        OPENAI_ERROR_CODE.PROVIDER_UNAVAILABLE,
        500,
      );
    } finally {
      if (prev_http !== undefined) process.env['HTTP_PROXY'] = prev_http;
      else delete process.env['HTTP_PROXY'];
      if (prev_https !== undefined) process.env['HTTPS_PROXY'] = prev_https;
      else delete process.env['HTTPS_PROXY'];
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
