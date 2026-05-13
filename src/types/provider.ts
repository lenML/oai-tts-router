/**
 * TTS Provider abstraction interface.
 * Providers implement TtsProvider to integrate different TTS channels.
 *
 * Each provider can define a zod request_schema to validate and parse
 * incoming request bodies. The base router ensures `model` and `input`
 * are always present; the provider schema extends that with its own fields.
 */

import type { z } from 'zod';

/** Standard speech synthesis parameters passed to a TTS Provider. */
export interface SpeechParams {
  /** Model ID requested by the user */
  model: string;
  /** Text to synthesize */
  input: string;
  /** Provider-specific parameters validated by request_schema */
  extra: Record<string, unknown>;
}

/** Result of TTS Provider speech synthesis */
export interface SpeechResult {
  /** Content-Type of the audio data */
  content_type: string;
  /** Binary audio data */
  data: Buffer;
}

/**
 * TTS Provider interface.
 * All TTS channels must implement this interface.
 */
export interface TtsProvider {
  /** Unique provider name */
  readonly name: string;

  /**
   * Optional zod schema for request validation.
   * If provided, incoming request bodies are validated against this schema
   * before being passed to speak(). The schema should extend the base
   * tts_request_base schema to inherit model/input validation.
   */
  request_schema?: z.ZodType<Record<string, unknown>>;

  /**
   * Return the list of model IDs supported by this provider.
   */
  get_models(): string[];

  /**
   * Check whether the given model is supported.
   * @param model - Model ID
   */
  supports_model(model: string): boolean;

  /**
   * Synthesize text to speech.
   * @param params - Synthesis parameters
   * @returns Result containing Content-Type and audio Buffer
   */
  speak(params: SpeechParams): Promise<SpeechResult>;
}
