/**
 * Google Translate TTS provider.
 * Uses @sefinek/google-tts-api to obtain audio URLs from Google Translate,
 * then fetches and returns the audio data with browser-like headers.
 *
 * When HTTP_PROXY / HTTPS_PROXY env vars are set, requests are routed
 * through the proxy via proxy-agent.
 *
 * Supported extra params:
 *   - `lang`: language code (auto-detect if omitted)
 *   - `slow`: boolean for slower speech (default false)
 */

import { z } from 'zod';
import * as google_tts from '@sefinek/google-tts-api';
import fetch from 'node-fetch';
import { ProxyAgent } from 'proxy-agent';
import { OpenAiError, upstream_error_details } from '../errors.js';
import { tts_request_extended } from '../types/schema.js';
import { OPENAI_ERROR_TYPE } from '../types/openai.js';
import { detect_language } from '../utils/lang.js';
import { split_text } from '../utils/text-split.js';
import type { TtsProvider, SpeechParams, SpeechResult } from '../types/provider.js';

/** Zod schema for Google TTS request validation */
const google_tts_schema = tts_request_extended.extend({
  lang: z.string().optional(),
  slow: z.boolean().optional(),
  response_format: z.enum(['mp3']).optional(),
});

/** Maximum characters per Google TTS request */
const MAX_CHARS = 200;

/** Lazy proxy agents keyed by proxy URL. */
const proxy_agents = new Map<string, ProxyAgent>();

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

/**
 * Browser-like headers object.
 * HTTP header names use hyphens; assigned via bracket notation to
 * avoid ESLint snake_case naming restriction on object properties.
 */
const BROWSER_HEADERS: Record<string, string> = {};

BROWSER_HEADERS['User-Agent'] =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

BROWSER_HEADERS['Accept'] = 'audio/mpeg,audio/*;q=0.9,*/*;q=0.8';

BROWSER_HEADERS['Accept-Language'] = 'en-US,en;q=0.9';

export class GoogleTtsProvider implements TtsProvider {
  readonly name = 'google-translate';
  request_schema = google_tts_schema;

  private proxy_url?: string;

  constructor(config?: Record<string, unknown>) {
    this.proxy_url =
      typeof config?.['proxy'] === 'string' && config['proxy'].trim().length > 0
        ? config['proxy']
        : undefined;
  }

  get_models(): string[] {
    return ['google-translate'];
  }

  get_model_voices(_model: string): string[] {
    return [];
  }

  supports_model(model: string): boolean {
    return model === 'google-translate';
  }

  async speak(params: SpeechParams): Promise<SpeechResult> {
    const text = params.input;
    const lang = (params.extra['lang'] as string | undefined) ?? detect_language(text);
    const slow = (params.extra['slow'] as boolean | undefined) ?? false;

    const parts = split_text(text, MAX_CHARS);
    const urls = parts.map(part => google_tts.getAudioUrl(part, { lang, slow }));
    const buffers = await Promise.all(urls.map(url => fetch_audio(url, this.proxy_url)));
    const buffer = buffers.length === 1 ? buffers[0] : Buffer.concat(buffers);

    return { content_type: 'audio/mpeg', data: buffer };
  }
}

/** Fetch audio data from a Google TTS URL with browser impersonation */
async function fetch_audio(url: string, proxy_url?: string): Promise<Buffer> {
  const agent = get_proxy_agent(proxy_url);
  let last_status: number | undefined;
  let last_body: Buffer | undefined;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, {
        headers: BROWSER_HEADERS,
        signal: AbortSignal.timeout(15000),
        ...(agent ? { agent } : {}),
      });
      if (response.ok) {
        const array_buffer = await response.arrayBuffer();
        return Buffer.from(array_buffer);
      }

      last_status = response.status;
      last_body = Buffer.from(await response.arrayBuffer());
      if (response.status < 500 && response.status !== 429) break;
    } catch {
      // Retry transient network and timeout failures.
    }

    if (attempt < 2) await sleep(250 * 2 ** attempt);
  }

  if (last_status) {
    throw upstream_error(last_status, last_body);
  }
  throw new OpenAiError(
    'Google TTS upstream request failed',
    OPENAI_ERROR_TYPE.PROVIDER,
    null,
    'provider_unavailable',
    502,
  );
}

function upstream_error(status: number, body?: Buffer): OpenAiError {
  const type =
    status === 429
      ? OPENAI_ERROR_TYPE.RATE_LIMIT
      : status >= 500
        ? OPENAI_ERROR_TYPE.SERVER
        : OPENAI_ERROR_TYPE.INVALID_REQUEST;
  const details = body
    ? upstream_error_details(body)
    : { message: undefined, param: null, code: null, raw: '' };
  return new OpenAiError(
    `Google TTS upstream returned HTTP ${status}${details.message ? `: ${details.message}` : ''}`,
    type,
    details.param,
    details.code,
    status,
  );
}

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
