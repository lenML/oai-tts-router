/**
 * ElevenLabs text-to-speech provider.
 * Calls POST /v1/text-to-speech/{voice_id} with optional key rotation.
 *
 * Configuration:
 *   `providers.elevenlabs.keys` - API key string or array
 *   `ELEVENLABS_API_KEY` - comma-separated API keys
 *
 * Request-level credentials:
 *   `keys`: string[] - keys to try in order
 *   `api_key`: string - single-key alias
 */

import { z } from 'zod';
import fetch from 'node-fetch';
import { ProxyAgent } from 'proxy-agent';
import { OpenAiError, upstream_error_details } from '../errors.js';
import { tts_request_extended } from '../types/schema.js';
import { OPENAI_ERROR_CODE, OPENAI_ERROR_TYPE } from '../types/openai.js';
import type { TtsProvider, SpeechParams, SpeechResult } from '../types/provider.js';

const DEFAULT_BASE_URL = 'https://api.elevenlabs.io';
const DEFAULT_MODEL = 'eleven_multilingual_v2';
const DEFAULT_VOICE_ID = 'JBFqnCBsd6RMkjVDRZzb';
const DEFAULT_OUTPUT_FORMAT = 'mp3_44100_128';

const ELEVENLABS_MODELS = [
  'eleven_v3',
  'eleven_multilingual_v2',
  'eleven_flash_v2_5',
  'eleven_turbo_v2_5',
  'eleven_flash_v2',
  'eleven_turbo_v2',
  'eleven_monolingual_v1',
  'eleven_multilingual_v1',
] as const;

const OUTPUT_FORMATS = [
  'alaw_8000',
  'mp3_22050_32',
  'mp3_24000_48',
  'mp3_44100_32',
  'mp3_44100_64',
  'mp3_44100_96',
  'mp3_44100_128',
  'mp3_44100_192',
  'opus_48000_32',
  'opus_48000_64',
  'opus_48000_96',
  'opus_48000_128',
  'opus_48000_192',
  'pcm_8000',
  'pcm_16000',
  'pcm_22050',
  'pcm_24000',
  'pcm_32000',
  'pcm_44100',
  'pcm_48000',
  'ulaw_8000',
  'wav_8000',
  'wav_16000',
  'wav_22050',
  'wav_24000',
  'wav_32000',
  'wav_44100',
  'wav_48000',
] as const;

const RESPONSE_FORMAT_TO_OUTPUT: Record<string, string> = {
  mp3: 'mp3_44100_128',
  wav: 'wav_44100',
  pcm: 'pcm_24000',
  opus: 'opus_48000_128',
  ulaw: 'ulaw_8000',
  alaw: 'alaw_8000',
};

const elevenlabs_schema = tts_request_extended.extend({
  voice: z.string().min(1).optional(),
  voice_id: z.string().min(1).optional(),
  model_id: z.string().min(1).optional(),
  language_code: z.string().min(1).optional(),
  response_format: z.enum(['mp3', 'wav', 'pcm', 'opus', 'ulaw', 'alaw']).optional(),
  output_format: z.enum(OUTPUT_FORMATS).optional(),
  enable_logging: z.boolean().optional(),
  optimize_streaming_latency: z.number().int().min(0).max(4).optional(),
  voice_settings: z
    .object({
      stability: z.number().finite().optional(),
      similarity_boost: z.number().finite().optional(),
      style: z.number().finite().optional(),
      speed: z.number().finite().optional(),
      use_speaker_boost: z.boolean().optional(),
    })
    .optional(),
  stability: z.number().finite().optional(),
  similarity_boost: z.number().finite().optional(),
  style: z.number().finite().optional(),
  speed: z.number().finite().optional(),
  use_speaker_boost: z.boolean().optional(),
  pronunciation_dictionary_locators: z
    .array(
      z.object({
        pronunciation_dictionary_id: z.string().min(1),
        version_id: z.string().min(1).optional(),
      }),
    )
    .max(3)
    .optional(),
  seed: z.number().int().min(0).max(4_294_967_295).optional(),
  previous_text: z.string().optional(),
  next_text: z.string().optional(),
  previous_request_ids: z.array(z.string().min(1)).max(3).optional(),
  next_request_ids: z.array(z.string().min(1)).max(3).optional(),
  apply_text_normalization: z.enum(['auto', 'on', 'off']).optional(),
  apply_language_text_normalization: z.boolean().optional(),
  use_pvc_as_ivc: z.boolean().optional(),
  keys: z.array(z.string().min(1)).min(1).max(20).optional(),
  api_key: z.string().min(1).optional(),
});

const proxy_agents = new Map<string, ProxyAgent>();

export class ElevenlabsProvider implements TtsProvider {
  readonly name = 'elevenlabs';
  readonly owned_by = 'elevenlabs';
  request_schema = elevenlabs_schema;

  private keys: string[];
  private base_url: string;
  private proxy_url?: string;

  constructor(config?: Record<string, unknown>) {
    this.keys = parse_keys(config?.['keys'] ?? config?.['api_key']);
    this.base_url =
      optional_string(config?.['base_url']) ??
      process.env['ELEVENLABS_BASE_URL'] ??
      DEFAULT_BASE_URL;
    this.proxy_url = optional_string(config?.['proxy']);
  }

  get_models(): string[] {
    return ['elevenlabs', ...ELEVENLABS_MODELS];
  }

  get_model_voices(_model: string): string[] {
    return [];
  }

  supports_model(model: string): boolean {
    return model === 'elevenlabs' || model.startsWith('eleven_');
  }

  async speak(params: SpeechParams): Promise<SpeechResult> {
    const voice_id =
      optional_string(params.extra['voice_id']) ??
      optional_string(params.extra['voice']) ??
      DEFAULT_VOICE_ID;
    const model_id =
      optional_string(params.extra['model_id']) ??
      (params.model === 'elevenlabs' ? DEFAULT_MODEL : params.model);
    const output_format = resolve_output_format(params.extra);
    const request_keys = request_key_pool(params.extra);
    const available_keys = request_keys.length > 0 ? request_keys : [...this.keys];

    if (available_keys.length === 0) {
      throw no_key_error();
    }

    const body = build_request_body(params.input, model_id, params.extra);
    const url = build_url(this.base_url, voice_id, output_format, params.extra);
    const agent = get_proxy_agent(this.proxy_url);
    const max_attempts = available_keys.length + 3;

    for (let attempt = 0; attempt < max_attempts; attempt++) {
      const key = available_keys[attempt % available_keys.length];
      let response;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: {
            accept: 'audio/*',
            ['content-type']: 'application/json',
            ['xi-api-key']: key,
          },
          body,
          signal: AbortSignal.timeout(60_000),
          ...(agent ? { agent } : {}),
        });
      } catch (err) {
        if (attempt >= max_attempts - 1) {
          throw provider_error(
            `request failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
        await sleep(backoff_ms(attempt));
        continue;
      }

      const response_body = Buffer.from(await response.arrayBuffer());

      if (response.ok) {
        return {
          content_type: response_content_type(response.headers.get('content-type'), output_format),
          data: response_body,
        };
      }

      if (response.status === 401 || response.status === 403) {
        const key_index = available_keys.indexOf(key);
        if (key_index >= 0) available_keys.splice(key_index, 1);
        if (available_keys.length === 0) {
          throw authentication_error(response.status, response_body);
        }
        continue;
      }

      if (response.status === 429 || response.status >= 500) {
        if (attempt >= max_attempts - 1) {
          throw upstream_error(response.status, response_body);
        }
        await sleep(backoff_ms(attempt));
        continue;
      }

      throw upstream_error(response.status, response_body);
    }

    throw provider_error('request retry loop failed');
  }
}

function parse_keys(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((key): key is string => typeof key === 'string')
      .map(key => key.trim())
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map(key => key.trim())
      .filter(Boolean);
  }
  return [];
}

function request_key_pool(extra: Record<string, unknown>): string[] {
  const raw_keys = extra['keys'];
  if (Array.isArray(raw_keys)) {
    return raw_keys.filter((key): key is string => typeof key === 'string' && key.length > 0);
  }
  const api_key = optional_string(extra['api_key']);
  return api_key ? [api_key] : [];
}

function resolve_output_format(extra: Record<string, unknown>): string {
  const output_format = optional_string(extra['output_format']);
  if (output_format) return output_format;
  const response_format = optional_string(extra['response_format']);
  return response_format
    ? (RESPONSE_FORMAT_TO_OUTPUT[response_format] ?? DEFAULT_OUTPUT_FORMAT)
    : DEFAULT_OUTPUT_FORMAT;
}

function build_request_body(
  text: string,
  model_id: string,
  extra: Record<string, unknown>,
): string {
  const body: Record<string, unknown> = {
    text,
    model_id,
  };

  copy_if_present(body, extra, 'language_code');
  copy_if_present(body, extra, 'seed');
  copy_if_present(body, extra, 'previous_text');
  copy_if_present(body, extra, 'next_text');
  copy_if_present(body, extra, 'previous_request_ids');
  copy_if_present(body, extra, 'next_request_ids');
  copy_if_present(body, extra, 'apply_text_normalization');
  copy_if_present(body, extra, 'apply_language_text_normalization');
  copy_if_present(body, extra, 'use_pvc_as_ivc');
  copy_if_present(body, extra, 'pronunciation_dictionary_locators');

  const voice_settings: Record<string, unknown> = {};
  const nested_settings = extra['voice_settings'];
  if (is_record(nested_settings)) {
    Object.assign(voice_settings, nested_settings);
  }
  copy_if_present(voice_settings, extra, 'stability');
  copy_if_present(voice_settings, extra, 'similarity_boost');
  copy_if_present(voice_settings, extra, 'style');
  copy_if_present(voice_settings, extra, 'speed');
  copy_if_present(voice_settings, extra, 'use_speaker_boost');
  if (Object.keys(voice_settings).length > 0) {
    body['voice_settings'] = voice_settings;
  }

  return JSON.stringify(body);
}

function build_url(
  base_url: string,
  voice_id: string,
  output_format: string,
  extra: Record<string, unknown>,
): string {
  const url = new URL(`/v1/text-to-speech/${encodeURIComponent(voice_id)}`, base_url);
  url.searchParams.set('output_format', output_format);

  const enable_logging = extra['enable_logging'];
  if (typeof enable_logging === 'boolean') {
    url.searchParams.set('enable_logging', String(enable_logging));
  }

  const latency = extra['optimize_streaming_latency'];
  if (typeof latency === 'number') {
    url.searchParams.set('optimize_streaming_latency', String(latency));
  }

  return url.toString();
}

function copy_if_present(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
  key: string,
): void {
  if (source[key] !== undefined) target[key] = source[key];
}

function response_content_type(content_type: string | null, output_format: string): string {
  if (
    content_type &&
    !content_type.includes('application/json') &&
    !content_type.includes('application/octet-stream')
  ) {
    return content_type;
  }
  if (output_format.startsWith('mp3_')) return 'audio/mpeg';
  if (output_format.startsWith('wav_')) return 'audio/wav';
  if (output_format.startsWith('opus_')) return 'audio/ogg; codecs=opus';
  if (output_format.startsWith('ulaw_') || output_format.startsWith('alaw_')) return 'audio/basic';
  if (output_format.startsWith('pcm_')) {
    const sample_rate = output_format.split('_')[1] ?? '24000';
    return `audio/L16; rate=${sample_rate}; channels=1`;
  }
  return 'application/octet-stream';
}

function upstream_error(status: number, body: Buffer): OpenAiError {
  const details = upstream_error_details(body);
  const detail = details.message ?? parse_detail_message(body) ?? details.raw;
  const type =
    status === 401 || status === 403
      ? OPENAI_ERROR_TYPE.AUTHENTICATION
      : status === 429
        ? OPENAI_ERROR_TYPE.RATE_LIMIT
        : status >= 500
          ? OPENAI_ERROR_TYPE.SERVER
          : OPENAI_ERROR_TYPE.INVALID_REQUEST;

  return new OpenAiError(
    `elevenlabs returned HTTP ${status}${detail ? `: ${detail}` : ''}`,
    type,
    details.param,
    details.code,
    status,
  );
}

function parse_detail_message(body: Buffer): string | undefined {
  try {
    const parsed = JSON.parse(Buffer.from(body).toString('utf-8')) as {
      detail?: Array<{ msg?: unknown; loc?: unknown[]; type?: unknown }>;
    };
    const first = parsed.detail?.[0];
    if (!first) return undefined;
    const location = Array.isArray(first.loc) ? first.loc.join('.') : '';
    const type = typeof first.type === 'string' ? first.type : '';
    const message = typeof first.msg === 'string' ? first.msg : '';
    return [location, message, type].filter(Boolean).join(' ');
  } catch {
    return undefined;
  }
}

function authentication_error(status: number, body: Buffer): OpenAiError {
  const details = upstream_error_details(body);
  const detail = details.message ?? parse_detail_message(body) ?? 'all API keys rejected';
  return new OpenAiError(
    `elevenlabs authentication failed (${status}): ${detail}`,
    OPENAI_ERROR_TYPE.AUTHENTICATION,
    'keys',
    null,
    status,
  );
}

function no_key_error(): OpenAiError {
  return new OpenAiError(
    'No ElevenLabs API keys configured. Provide `keys`, `api_key`, or ELEVENLABS_API_KEY.',
    OPENAI_ERROR_TYPE.PROVIDER,
    'keys',
    OPENAI_ERROR_CODE.PROVIDER_UNAVAILABLE,
    502,
  );
}

function provider_error(message: string): OpenAiError {
  return new OpenAiError(
    `elevenlabs ${message}`,
    OPENAI_ERROR_TYPE.PROVIDER,
    null,
    OPENAI_ERROR_CODE.PROVIDER_UNAVAILABLE,
    502,
  );
}

function get_proxy_agent(proxy_url?: string): ProxyAgent | undefined {
  const url =
    proxy_url ??
    process.env['HTTPS_PROXY'] ??
    process.env['HTTP_PROXY'] ??
    process.env['https_proxy'] ??
    process.env['http_proxy'];
  if (!url) return undefined;

  let agent = proxy_agents.get(url);
  if (!agent) {
    agent = new ProxyAgent({
      // eslint-disable-next-line @typescript-eslint/naming-convention -- proxy-agent API shape
      getProxyForUrl: () => url,
    });
    proxy_agents.set(url, agent);
  }
  return agent;
}

function optional_string(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function is_record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function backoff_ms(attempt: number): number {
  return Math.min(500 * 2 ** attempt + Math.random() * 250, 5000);
}

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
