/**
 * OpenAI types and schema tests.
 */

import { describe, it, expect } from 'vitest';
import {
  OPENAI_VOICES,
  openai_tts_schema,
  OPENAI_ERROR_TYPE,
  OPENAI_ERROR_CODE,
} from '../../src/types/openai.js';
import { RESPONSE_FORMAT_MIME } from '../../src/types/schema.js';

describe('RESPONSE_FORMAT_MIME', () => {
  it('should map all common audio formats', () => {
    const formats = new Set(Object.keys(RESPONSE_FORMAT_MIME));
    expect(formats).toEqual(new Set(['mp3', 'opus', 'aac', 'flac', 'wav', 'pcm']));
  });

  it('should map mp3 to audio/mpeg', () => {
    expect(RESPONSE_FORMAT_MIME['mp3']).toBe('audio/mpeg');
  });

  it('should map pcm to audio/L16', () => {
    expect(RESPONSE_FORMAT_MIME['pcm']).toBe('audio/L16; rate=24000; channels=1');
  });
});

describe('OPENAI_VOICES', () => {
  it('should list common OpenAI voices', () => {
    expect(OPENAI_VOICES).toContain('alloy');
    expect(OPENAI_VOICES).toContain('nova');
    expect(OPENAI_VOICES).toContain('shimmer');
  });
});

describe('openai_tts_schema', () => {
  it('should accept a valid OpenAI TTS request', () => {
    const result = openai_tts_schema.safeParse({
      model: 'tts-1',
      input: 'Hello world',
      voice: 'alloy',
    });
    expect(result.success).toBe(true);
  });

  it('should accept optional fields', () => {
    const result = openai_tts_schema.safeParse({
      model: 'tts-1',
      input: 'Hello',
      voice: 'nova',
      response_format: 'wav',
      speed: 1.5,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.response_format).toBe('wav');
      expect(result.data.speed).toBe(1.5);
    }
  });

  it('should reject missing voice', () => {
    const result = openai_tts_schema.safeParse({
      model: 'tts-1',
      input: 'Hello',
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid speed', () => {
    const result = openai_tts_schema.safeParse({
      model: 'tts-1',
      input: 'Hello',
      voice: 'alloy',
      speed: 99,
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid response_format', () => {
    const result = openai_tts_schema.safeParse({
      model: 'tts-1',
      input: 'Hello',
      voice: 'alloy',
      response_format: 'midi',
    });
    expect(result.success).toBe(false);
  });
});

describe('OPENAI_ERROR_TYPE', () => {
  it('should have required error types', () => {
    expect(OPENAI_ERROR_TYPE.INVALID_REQUEST).toBe('invalid_request_error');
    expect(OPENAI_ERROR_TYPE.AUTHENTICATION).toBe('authentication_error');
    expect(OPENAI_ERROR_TYPE.RATE_LIMIT).toBe('rate_limit_error');
    expect(OPENAI_ERROR_TYPE.SERVER).toBe('server_error');
    expect(OPENAI_ERROR_TYPE.PROVIDER).toBe('provider_error');
  });
});

describe('OPENAI_ERROR_CODE', () => {
  it('should have required error codes', () => {
    expect(OPENAI_ERROR_CODE.PROVIDER_UNAVAILABLE).toBe('provider_unavailable');
    expect(OPENAI_ERROR_CODE.MODEL_NOT_FOUND).toBe('model_not_found');
    expect(OPENAI_ERROR_CODE.VOICE_NOT_SUPPORTED).toBe('voice_not_supported');
  });
});
