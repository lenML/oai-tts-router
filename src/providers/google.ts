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
import { tts_request_base } from '../types/schema.js';
import { detect_language } from '../utils/lang.js';
import type { TtsProvider, SpeechParams, SpeechResult } from '../types/provider.js';

/** Zod schema for Google TTS request validation */
const google_tts_schema = tts_request_base.extend({
  lang: z.string().optional(),
  slow: z.boolean().optional(),
});

/** Maximum characters per Google TTS request */
const MAX_CHARS = 200;

/** Whether a proxy is configured in environment */
const HAS_PROXY = (process.env.HTTP_PROXY ?? process.env.HTTPS_PROXY ?? '').length > 0;

/** Lazy proxy agent instance */
let proxy_agent: ProxyAgent | undefined;

function get_proxy_agent(): ProxyAgent | undefined {
  if (HAS_PROXY && proxy_agent === undefined) {
    proxy_agent = new ProxyAgent();
  }
  return proxy_agent;
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

  constructor(_config?: Record<string, unknown>) {
    // Config available for future provider-specific options
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

    let buffer: Buffer;
    if (text.length <= MAX_CHARS) {
      const url = google_tts.getAudioUrl(text, { lang, slow });
      buffer = await fetch_audio(url);
    } else {
      const parts = google_tts.getAllAudioUrls(text, { lang, slow });
      const buffers = await Promise.all(parts.map(p => fetch_audio(p.url)));
      buffer = Buffer.concat(buffers);
    }

    return { content_type: 'audio/mpeg', data: buffer };
  }
}

/** Fetch audio data from a Google TTS URL with browser impersonation */
async function fetch_audio(url: string): Promise<Buffer> {
  const agent = get_proxy_agent();
  const response = await fetch(url, {
    headers: BROWSER_HEADERS,
    ...(agent ? { agent } : {}),
  });
  if (!response.ok) {
    throw new Error(`Google TTS request failed: ${response.status} ${response.statusText}`);
  }
  const array_buffer = await response.arrayBuffer();
  return Buffer.from(array_buffer);
}
