/**
 * Zod schemas for TTS request validation.
 *
 * The base schema validates only universal fields (model, input).
 * Providers extend this with their own schemas.
 */

import { z } from 'zod';

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

export type TtsRequestBase = z.infer<typeof tts_request_base>;

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
