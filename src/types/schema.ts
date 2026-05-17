/**
 * Zod schemas for TTS request validation.
 *
 * The base schema validates only universal fields (model, input).
 * Providers extend this with their own schemas.
 */

import { z } from 'zod';

/** Max input length for text_split requests */
export const TEXT_SPLIT_MAX_INPUT = 100_000;

/** Base TTS request - every request needs at least model and input. */
export const tts_request_base = z.object({
  model: z.string().min(1, { message: 'The `model` parameter is required.' }),
  input: z
    .string()
    .min(1, { message: 'The `input` parameter is required.' })
    .max(4096, { message: 'The `input` parameter must not exceed 4096 characters.' }),
  /** Skip cache for this request */
  no_cache: z.boolean().optional(),
});

/** Extended TTS request with text_split and fallback support. */
export const tts_request_extended = tts_request_base.extend({
  /** Split long text into chunks and concatenate audio */
  text_split: z.boolean().optional(),
  /** Max characters per chunk when text_split is enabled (default 1000) */
  text_split_max_length: z.number().int().positive().max(10000).optional(),
  /** Fallback model IDs to try if the primary model fails */
  fallback_models: z.array(z.string().min(1)).optional(),
});

export type TtsRequestBase = z.infer<typeof tts_request_base>;
export type TtsRequestExtended = z.infer<typeof tts_request_extended>;

/** Common audio output formats */
export const AUDIO_FORMATS = ['mp3', 'opus', 'aac', 'flac', 'wav', 'pcm'] as const;

/** response_format to Content-Type mapping */
export const RESPONSE_FORMAT_MIME: Record<string, string> = {
  mp3: 'audio/mpeg',
  opus: 'audio/ogg; codecs=opus',
  aac: 'audio/aac',
  flac: 'audio/flac',
  wav: 'audio/wav',
  pcm: 'audio/L16; rate=24000; channels=1',
};
