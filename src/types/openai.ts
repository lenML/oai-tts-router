/**
 * OpenAI TTS API types and zod schema.
 * Reference: https://platform.openai.com/docs/api-reference/audio/createSpeech
 *
 * This schema extends the base TTS schema with OpenAI-specific fields.
 * It is a utility for OpenAI-compatible providers, not enforced by the core router.
 */

import { z } from 'zod';
import { tts_request_base } from './schema.js';

/** OpenAI-supported voices (from the official API) */
export const OPENAI_VOICES = [
  'alloy',
  'echo',
  'fable',
  'onyx',
  'nova',
  'shimmer',
  'ash',
  'ballad',
  'coral',
  'sage',
  'verse',
  'marin',
  'cedar',
] as const;

/** OpenAI response format values */
export const OPENAI_RESPONSE_FORMATS = ['mp3', 'opus', 'aac', 'flac', 'wav', 'pcm'] as const;

/** OpenAI TTS request schema - extends the base with OpenAI-specific fields. */
export const openai_tts_schema = tts_request_base.extend({
  voice: z.string().min(1, { message: 'The `voice` parameter is required.' }),
  response_format: z.enum(OPENAI_RESPONSE_FORMATS).optional(),
  speed: z.number().min(0.25).max(4.0).optional(),
});

export type OpenAiTtsRequest = z.infer<typeof openai_tts_schema>;

/** OpenAI standard error response body */
export interface OpenAiErrorBody {
  error: {
    message: string;
    type: string;
    param: string | null;
    code: string | null;
  };
}

/** OpenAI error types */
export const OPENAI_ERROR_TYPE = {
  INVALID_REQUEST: 'invalid_request_error',
  AUTHENTICATION: 'authentication_error',
  RATE_LIMIT: 'rate_limit_error',
  SERVER: 'server_error',
  PROVIDER: 'provider_error',
} as const;

/** OpenAI error codes */
export const OPENAI_ERROR_CODE = {
  PROVIDER_UNAVAILABLE: 'provider_unavailable',
  MODEL_NOT_FOUND: 'model_not_found',
  VOICE_NOT_SUPPORTED: 'voice_not_supported',
} as const;
