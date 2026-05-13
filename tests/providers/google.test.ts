/**
 * Google TTS provider tests.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GoogleTtsProvider } from '../../src/providers/google.js';

const mock_fetch = vi.hoisted(() => vi.fn());

vi.mock('node-fetch', () => ({
  default: mock_fetch,
}));

vi.mock('@sefinek/google-tts-api', () => ({
  getAudioUrl: vi.fn(
    (text: string, _opts: unknown) =>
      `https://tts.google.com/audio?text=${encodeURIComponent(text)}`,
  ),
  getAllAudioUrls: vi.fn((text: string, _opts: unknown) => [
    {
      shortText: text.slice(0, 100),
      url: `https://tts.google.com/audio?text=${encodeURIComponent(text.slice(0, 100))}`,
    },
  ]),
}));

function mock_audio_response(data: string): void {
  mock_fetch.mockResolvedValue({
    ok: true,
    arrayBuffer: () => Promise.resolve(Buffer.from(data, 'utf-8')),
  });
}

describe('GoogleTtsProvider', () => {
  let provider: GoogleTtsProvider;

  beforeEach(() => {
    provider = new GoogleTtsProvider();
    mock_fetch.mockReset();
  });

  it('should have correct name and models', () => {
    expect(provider.name).toBe('google-translate');
    expect(provider.get_models()).toEqual(['google-translate']);
    expect(provider.supports_model('google-translate')).toBe(true);
    expect(provider.supports_model('tts-1')).toBe(false);
  });

  it('should have a request_schema', () => {
    expect(provider.request_schema).toBeDefined();
  });

  describe('schema validation', () => {
    it('should accept request with only model and input', () => {
      const result = provider.request_schema!.safeParse({
        model: 'google-translate',
        input: 'Hello world',
      });
      expect(result.success).toBe(true);
    });

    it('should accept lang parameter', () => {
      const result = provider.request_schema!.safeParse({
        model: 'google-translate',
        input: 'Hello',
        lang: 'zh-CN',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.data as Record<string, unknown>).lang).toBe('zh-CN');
      }
    });

    it('should accept slow parameter', () => {
      const result = provider.request_schema!.safeParse({
        model: 'google-translate',
        input: 'Hello',
        slow: true,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.data as Record<string, unknown>).slow).toBe(true);
      }
    });

    it('should reject non-boolean slow', () => {
      const result = provider.request_schema!.safeParse({
        model: 'google-translate',
        input: 'Hello',
        slow: 'yes',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('speak', () => {
    it('should return audio/mpeg for short text', async () => {
      mock_audio_response('fake-mp3-data');

      const result = await provider.speak({
        model: 'google-translate',
        input: 'Hello world',
        extra: {},
      });

      expect(result.content_type).toBe('audio/mpeg');
      expect(result.data.toString()).toBe('fake-mp3-data');
    });

    it('should pass lang from extra to googleTts', async () => {
      mock_audio_response('audio-data');

      const { getAudioUrl } = await import('@sefinek/google-tts-api');

      await provider.speak({
        model: 'google-translate',
        input: 'Hola',
        extra: { lang: 'es' },
      });

      expect(getAudioUrl).toHaveBeenCalledWith('Hola', { lang: 'es', slow: false });
    });

    it('should detect language when lang is not provided', async () => {
      mock_audio_response('audio');

      const { getAudioUrl } = await import('@sefinek/google-tts-api');

      await provider.speak({
        model: 'google-translate',
        input: '你好世界',
        extra: {},
      });

      expect(getAudioUrl).toHaveBeenCalledWith('你好世界', { lang: 'zh-CN', slow: false });
    });

    it('should send browser-like headers', async () => {
      mock_audio_response('data');

      await provider.speak({
        model: 'google-translate',
        input: 'Hello',
        extra: { lang: 'en' },
      });

      const call_args = mock_fetch.mock.calls[0];
      expect(call_args[1].headers).toBeDefined();
      expect(call_args[1].headers['User-Agent']).toContain('Chrome/131');
    });

    it('should return audio/mpeg for long text via getAllAudioUrls', async () => {
      mock_audio_response('part1');
      const long_text = 'x'.repeat(250);

      const result = await provider.speak({
        model: 'google-translate',
        input: long_text,
        extra: { lang: 'en' },
      });

      expect(result.content_type).toBe('audio/mpeg');
    });
  });
});
