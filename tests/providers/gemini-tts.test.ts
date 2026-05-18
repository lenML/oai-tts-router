/**
 * Gemini TTS provider tests.
 * Mocks cuimp to avoid actual network calls.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GeminiTtsProvider } from '../../src/providers/gemini-tts.js';

const mock_request = vi.hoisted(() => vi.fn());

vi.mock('cuimp', () => ({
  createCuimpHttp: vi.fn(() => ({
    request: mock_request,
  })),
}));

/** Helper: mock a successful response with JSON audioContent body */
function mock_json_success(audio_b64: string, status = 200) {
  mock_request.mockResolvedValue({
    status,
    headers: { 'content-type': 'text/plain;charset=UTF-8' },
    rawBody: Buffer.from(JSON.stringify({ audioContent: audio_b64 })),
  });
}

/** Helper: mock a successful response with raw base64 body */
function mock_raw_success(audio_b64: string, status = 200) {
  mock_request.mockResolvedValue({
    status,
    headers: { 'content-type': 'text/plain;charset=UTF-8' },
    rawBody: Buffer.from(audio_b64),
  });
}

/** Helper: mock a successful response with data URL body */
function mock_data_url_success(audio_b64: string, status = 200) {
  mock_request.mockResolvedValue({
    status,
    headers: { 'content-type': 'text/plain;charset=UTF-8' },
    rawBody: Buffer.from(`data:audio/mpeg;base64,${audio_b64}`),
  });
}

describe('GeminiTtsProvider', () => {
  let provider: GeminiTtsProvider;

  beforeEach(() => {
    provider = new GeminiTtsProvider({
      tokens: ['token-a', 'token-b'],
    });
    mock_request.mockReset();
  });

  describe('basic info', () => {
    it('should have correct name', () => {
      expect(provider.name).toBe('gemini-tts');
    });

    it('should have owned_by set to google', () => {
      expect(provider.owned_by).toBe('google');
    });

    it('should return models list', () => {
      expect(provider.get_models()).toEqual([
        'gemini-3.1-flash-tts-preview',
        'gemini-2.5-flash-tts',
        'gemini-2.5-pro-tts',
        'gemini-2.5-flash-lite-preview-tts',
        'chirp3-hd',
      ]);
    });

    it('should support gemini-tts model', () => {
      expect(provider.supports_model('gemini-tts')).toBe(true);
    });

    it('should support all gemini tts model IDs', () => {
      expect(provider.supports_model('gemini-3.1-flash-tts-preview')).toBe(true);
      expect(provider.supports_model('gemini-2.5-flash-tts')).toBe(true);
      expect(provider.supports_model('gemini-2.5-pro-tts')).toBe(true);
      expect(provider.supports_model('gemini-2.5-flash-lite-preview-tts')).toBe(true);
      expect(provider.supports_model('chirp3-hd')).toBe(true);
    });

    it('should not support unknown models', () => {
      expect(provider.supports_model('tts-1')).toBe(false);
    });

    it('should return default voices', () => {
      const voices = provider.get_model_voices('gemini-tts');
      expect(voices).toContain('Kore');
      expect(voices).toContain('Zephyr');
      expect(voices).toContain('Puck');
      expect(voices.length).toBe(30);
    });
  });

  describe('constructor token parsing', () => {
    it('should accept array of tokens', () => {
      const p = new GeminiTtsProvider({
        tokens: ['token1', 'token2', 'token3'],
      });
      expect(p.name).toBe('gemini-tts');
    });

    it('should accept a single token string', () => {
      const p = new GeminiTtsProvider({
        tokens: 'single-token-value',
      });
      expect(p.name).toBe('gemini-tts');
    });

    it('should filter empty tokens', () => {
      const p = new GeminiTtsProvider({
        tokens: ['valid', '', null, 'also-valid'],
      });
      expect(p.name).toBe('gemini-tts');
    });

    it('should default to empty array when no tokens provided', () => {
      const p = new GeminiTtsProvider({});
      expect(p.name).toBe('gemini-tts');
    });
  });

  describe('schema validation', () => {
    it('should accept request with only model and input', () => {
      const result = provider.request_schema!.safeParse({
        model: 'gemini-tts',
        input: 'Hello world',
      });
      expect(result.success).toBe(true);
    });

    it('should accept voice parameter', () => {
      const result = provider.request_schema!.safeParse({
        model: 'gemini-tts',
        input: 'Hello',
        voice: 'Kore',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.data as Record<string, unknown>).voice).toBe('Kore');
      }
    });

    it('should accept model parameter', () => {
      const result = provider.request_schema!.safeParse({
        model: 'gemini-tts',
        input: 'Hello',
        model: 'gemini-2.5-flash-tts',
      });
      expect(result.success).toBe(true);
    });

    it('should accept encoding parameter', () => {
      const result = provider.request_schema!.safeParse({
        model: 'gemini-tts',
        input: 'Hello',
        encoding: 'MP3',
      });
      expect(result.success).toBe(true);
    });

    it('should accept sample_rate parameter', () => {
      const result = provider.request_schema!.safeParse({
        model: 'gemini-tts',
        input: 'Hello',
        sample_rate: 48000,
      });
      expect(result.success).toBe(true);
    });

    it('should reject non-positive sample_rate', () => {
      const result = provider.request_schema!.safeParse({
        model: 'gemini-tts',
        input: 'Hello',
        sample_rate: -1,
      });
      expect(result.success).toBe(false);
    });

    it('should accept token parameter', () => {
      const result = provider.request_schema!.safeParse({
        model: 'gemini-tts',
        input: 'Hello',
        token: 'my-custom-token',
      });
      expect(result.success).toBe(true);
    });

    it('should accept instructions parameter (alias for prompt)', () => {
      const result = provider.request_schema!.safeParse({
        model: 'gemini-tts',
        input: 'Hello',
        instructions: 'Speak like a pirate',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.data as Record<string, unknown>).instructions).toBe('Speak like a pirate');
      }
    });

    it('should accept speed, pitch, gain parameters', () => {
      const result = provider.request_schema!.safeParse({
        model: 'gemini-tts',
        input: 'Hello',
        speed: 1.5,
        pitch: 2.0,
        gain: 3.0,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('speak', () => {
    it('should return audio/L16 for LINEAR16 encoding JSON response', async () => {
      mock_json_success('dGVzdC1hdWRpbw=='); // "test-audio" in base64

      const result = await provider.speak({
        model: 'gemini-tts',
        input: 'Hello world',
        extra: {},
      });

      expect(result.content_type).toBe('audio/L16; rate=24000; channels=1');
      expect(result.data.toString()).toBe('test-audio');
    });

    it('should return audio/mpeg for MP3 encoding', async () => {
      mock_json_success('bXAzLWF1ZGlv');

      const result = await provider.speak({
        model: 'gemini-tts',
        input: 'Hello',
        extra: { encoding: 'MP3' },
      });

      expect(result.content_type).toBe('audio/mpeg');
    });

    it('should default to Kore voice', async () => {
      mock_json_success('YXVkaW8=');

      await provider.speak({
        model: 'gemini-tts',
        input: 'Hello',
        extra: {},
      });

      const call_body = JSON.parse(mock_request.mock.calls[0][0].data);
      expect(call_body.voice.name).toBe('Kore');
    });

    it('should pass voice from extra', async () => {
      mock_json_success('YXVkaW8=');

      await provider.speak({
        model: 'gemini-tts',
        input: 'Hello',
        extra: { voice: 'Zephyr' },
      });

      const call_body = JSON.parse(mock_request.mock.calls[0][0].data);
      expect(call_body.voice.name).toBe('Zephyr');
    });

    it('should use request model when extra.model not set', async () => {
      mock_json_success('YXVkaW8=');

      await provider.speak({
        model: 'gemini-2.5-flash-tts',
        input: 'Hello',
        extra: {},
      });

      const call_body = JSON.parse(mock_request.mock.calls[0][0].data);
      expect(call_body.voice.modelName).toBe('gemini-2.5-flash-tts');
    });

    it('should pass model from extra', async () => {
      mock_json_success('YXVkaW8=');

      await provider.speak({
        model: 'gemini-tts',
        input: 'Hello',
        extra: { model: 'gemini-2.5-pro-tts' },
      });

      const call_body = JSON.parse(mock_request.mock.calls[0][0].data);
      expect(call_body.voice.modelName).toBe('gemini-2.5-pro-tts');
    });

    it('should pass language from extra', async () => {
      mock_json_success('YXVkaW8=');

      await provider.speak({
        model: 'gemini-tts',
        input: 'Hello',
        extra: { language: 'zh-CN' },
      });

      const call_body = JSON.parse(mock_request.mock.calls[0][0].data);
      expect(call_body.voice.languageCode).toBe('zh-CN');
    });

    it('should include prompt in request body', async () => {
      mock_json_success('YXVkaW8=');

      await provider.speak({
        model: 'gemini-tts',
        input: 'Hello',
        extra: { prompt: 'Say warmly' },
      });

      const call_body = JSON.parse(mock_request.mock.calls[0][0].data);
      expect(call_body.input.prompt).toBe('Say warmly');
    });

    it('should use instructions as prompt in request body', async () => {
      mock_json_success('YXVkaW8=');

      await provider.speak({
        model: 'gemini-tts',
        input: 'Hello',
        extra: { instructions: 'Speak like a pirate' },
      });

      const call_body = JSON.parse(mock_request.mock.calls[0][0].data);
      expect(call_body.input.prompt).toBe('Speak like a pirate');
    });

    it('should prefer instructions over prompt', async () => {
      mock_json_success('YXVkaW8=');

      await provider.speak({
        model: 'gemini-tts',
        input: 'Hello',
        extra: { prompt: 'Old style', instructions: 'New style' },
      });

      const call_body = JSON.parse(mock_request.mock.calls[0][0].data);
      expect(call_body.input.prompt).toBe('New style');
    });

    it('should include gender in request body', async () => {
      mock_json_success('YXVkaW8=');

      await provider.speak({
        model: 'gemini-tts',
        input: 'Hello',
        extra: { gender: 'female' },
      });

      const call_body = JSON.parse(mock_request.mock.calls[0][0].data);
      expect(call_body.voice.ssmlGender).toBe('FEMALE');
    });

    it('should include audioConfig sample rate', async () => {
      mock_json_success('YXVkaW8=');

      await provider.speak({
        model: 'gemini-tts',
        input: 'Hello',
        extra: { sample_rate: 48000 },
      });

      const call_body = JSON.parse(mock_request.mock.calls[0][0].data);
      expect(call_body.audioConfig.sampleRateHertz).toBe(48000);
    });

    it('should encode token in request URL', async () => {
      mock_json_success('YXVkaW8=');

      await provider.speak({
        model: 'gemini-tts',
        input: 'Hello',
        extra: {},
      });

      const url = mock_request.mock.calls[0][0].url;
      expect(url).toContain('token=');
      expect(url).toMatch(/token=(token-a|token-b)/);
    });

    it('should handle raw base64 response (no JSON wrapper)', async () => {
      mock_raw_success('cmF3LWF1ZGlv');

      const result = await provider.speak({
        model: 'gemini-tts',
        input: 'Hello',
        extra: {},
      });

      expect(result.data.toString()).toBe('raw-audio');
    });

    it('should handle data URL response', async () => {
      mock_data_url_success('ZGF0YS11cmwtYXVkaW8=');

      const result = await provider.speak({
        model: 'gemini-tts',
        input: 'Hello',
        extra: {},
      });

      expect(result.data.toString()).toBe('data-url-audio');
    });

    it('should throw if no tokens configured', async () => {
      const p = new GeminiTtsProvider({});
      await expect(
        p.speak({
          model: 'gemini-tts',
          input: 'test',
          extra: {},
        }),
      ).rejects.toThrow('No tokens configured');
    });

    it('should use per-request token from extra when provided', async () => {
      mock_json_success('YXVkaW8=');

      await provider.speak({
        model: 'gemini-tts',
        input: 'Hello',
        extra: { token: 'req-token-123' },
      });

      const url = mock_request.mock.calls[0][0].url;
      expect(url).toContain('token=req-token-123');
    });

    it('should skip retry when using per-request token', async () => {
      mock_request.mockResolvedValue({
        status: 401,
        headers: { 'content-type': 'text/plain' },
        rawBody: Buffer.from('unauthorized'),
      });

      await expect(
        provider.speak({
          model: 'gemini-tts',
          input: 'Hello',
          extra: { token: 'req-token-123' },
        }),
      ).rejects.toThrow('all tokens rejected (401)');
      expect(mock_request).toHaveBeenCalledTimes(1);
    });

    it('should set correct MIME type with sample_rate override', async () => {
      mock_json_success('YXVkaW8=');

      const result = await provider.speak({
        model: 'gemini-tts',
        input: 'Hello',
        extra: { encoding: 'LINEAR16', sample_rate: 48000 },
      });

      expect(result.content_type).toBe('audio/L16; rate=48000; channels=1');
    });
  });

  describe('retry logic', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('should immediately retry with next token on 401', async () => {
      mock_request
        .mockResolvedValueOnce({
          status: 401,
          headers: { 'content-type': 'text/plain' },
          rawBody: Buffer.from('token expired'),
        })
        .mockResolvedValueOnce({
          status: 200,
          headers: { 'content-type': 'text/plain' },
          rawBody: Buffer.from(JSON.stringify({ audioContent: 'YXVkaW8=' })),
        });

      const result = await provider.speak({
        model: 'gemini-tts',
        input: 'Hello',
        extra: {},
      });

      expect(result.content_type).toBe('audio/L16; rate=24000; channels=1');
      expect(result.data.toString()).toBe('audio');
      expect(mock_request).toHaveBeenCalledTimes(2);
      const firstUrl = mock_request.mock.calls[0][0].url;
      const secondUrl = mock_request.mock.calls[1][0].url;
      expect(firstUrl).not.toBe(secondUrl);
    });

    it('should retry on 429 and succeed', async () => {
      vi.useFakeTimers();
      mock_request
        .mockResolvedValueOnce({
          status: 429,
          headers: { 'content-type': 'text/plain' },
          rawBody: Buffer.from('rate limited'),
        })
        .mockResolvedValueOnce({
          status: 200,
          headers: { 'content-type': 'text/plain' },
          rawBody: Buffer.from(JSON.stringify({ audioContent: 'YXVkaW8=' })),
        });

      const promise = provider.speak({
        model: 'gemini-tts',
        input: 'Hello',
        extra: {},
      });
      await vi.advanceTimersByTimeAsync(3000);
      const result = await promise;

      expect(result.content_type).toBe('audio/L16; rate=24000; channels=1');
      expect(mock_request).toHaveBeenCalledTimes(2);
    });

    it('should retry on 500 and succeed', async () => {
      vi.useFakeTimers();
      mock_request
        .mockResolvedValueOnce({
          status: 500,
          headers: { 'content-type': 'text/plain' },
          rawBody: Buffer.from('server error'),
        })
        .mockResolvedValueOnce({
          status: 200,
          headers: { 'content-type': 'text/plain' },
          rawBody: Buffer.from(JSON.stringify({ audioContent: 'YXVkaW8=' })),
        });

      const promise = provider.speak({
        model: 'gemini-tts',
        input: 'Hello',
        extra: {},
      });
      await vi.advanceTimersByTimeAsync(3000);
      const result = await promise;

      expect(result.content_type).toBe('audio/L16; rate=24000; channels=1');
      expect(mock_request).toHaveBeenCalledTimes(2);
    });

    it('should retry on 503 and succeed', async () => {
      vi.useFakeTimers();
      mock_request
        .mockResolvedValueOnce({
          status: 503,
          headers: { 'content-type': 'text/plain' },
          rawBody: Buffer.from('service unavailable'),
        })
        .mockResolvedValueOnce({
          status: 200,
          headers: { 'content-type': 'text/plain' },
          rawBody: Buffer.from(JSON.stringify({ audioContent: 'YXVkaW8=' })),
        });

      const promise = provider.speak({
        model: 'gemini-tts',
        input: 'Hello',
        extra: {},
      });
      await vi.advanceTimersByTimeAsync(3000);
      const result = await promise;

      expect(result.content_type).toBe('audio/L16; rate=24000; channels=1');
      expect(mock_request).toHaveBeenCalledTimes(2);
    });

    it('should throw after exhausting all retries on 429', async () => {
      vi.useFakeTimers();
      mock_request.mockResolvedValue({
        status: 429,
        headers: { 'content-type': 'text/plain' },
        rawBody: Buffer.from('rate limited'),
      });

      const promise = provider
        .speak({
          model: 'gemini-tts',
          input: 'Hello',
          extra: {},
        })
        .catch(e => e);
      await vi.advanceTimersByTimeAsync(16000);
      const error = await promise;
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain('after 3 retries');
    });

    it('should retry on network error and succeed', async () => {
      vi.useFakeTimers();
      mock_request.mockRejectedValueOnce(new Error('Network failure')).mockResolvedValueOnce({
        status: 200,
        headers: { 'content-type': 'text/plain' },
        rawBody: Buffer.from(JSON.stringify({ audioContent: 'YXVkaW8=' })),
      });

      const promise = provider.speak({
        model: 'gemini-tts',
        input: 'Hello',
        extra: {},
      });
      await vi.advanceTimersByTimeAsync(3000);
      const result = await promise;

      expect(result.content_type).toBe('audio/L16; rate=24000; channels=1');
      expect(result.data.toString()).toBe('audio');
      expect(mock_request).toHaveBeenCalledTimes(2);
    });

    it('should throw on network error after exhausting retries', async () => {
      vi.useFakeTimers();
      mock_request.mockRejectedValue(new Error('Persistent failure'));

      const promise = provider
        .speak({
          model: 'gemini-tts',
          input: 'Hello',
          extra: {},
        })
        .catch(e => e);
      await vi.advanceTimersByTimeAsync(16000);
      const error = await promise;
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain('Persistent failure');
    });

    it('should switch tokens on retry when multiple tokens available', async () => {
      vi.useFakeTimers();
      const orig_random = Math.random;
      Math.random = () => 0.5;
      try {
        const multi_provider = new GeminiTtsProvider({
          tokens: ['token-a', 'token-b', 'token-c'],
        });

        mock_request
          .mockResolvedValueOnce({
            status: 429,
            headers: { 'content-type': 'text/plain' },
            rawBody: Buffer.from('rate limited'),
          })
          .mockResolvedValueOnce({
            status: 200,
            headers: { 'content-type': 'text/plain' },
            rawBody: Buffer.from(JSON.stringify({ audioContent: 'YXVkaW8=' })),
          });

        const promise = multi_provider.speak({
          model: 'gemini-tts',
          input: 'Hello',
          extra: {},
        });
        await vi.advanceTimersByTimeAsync(3000);
        const result = await promise;

        expect(result.content_type).toBe('audio/L16; rate=24000; channels=1');
        expect(mock_request).toHaveBeenCalledTimes(2);

        const first_token = mock_request.mock.calls[0][0].url;
        const second_token = mock_request.mock.calls[1][0].url;
        expect(first_token).not.toBe(second_token);
      } finally {
        Math.random = orig_random;
      }
    });

    it('should fail immediately on 401 when only one token configured', async () => {
      const single = new GeminiTtsProvider({
        tokens: ['single-token'],
      });
      mock_request.mockResolvedValue({
        status: 401,
        headers: { 'content-type': 'text/plain' },
        rawBody: Buffer.from('unauthorized'),
      });

      await expect(
        single.speak({
          model: 'gemini-tts',
          input: 'Hello',
          extra: {},
        }),
      ).rejects.toThrow('all tokens rejected (401)');
      expect(mock_request).toHaveBeenCalledTimes(1);
    });

    it('should fail when all tokens return 401', async () => {
      const multi = new GeminiTtsProvider({
        tokens: ['token-ex-1', 'token-ex-2', 'token-ex-3'],
      });
      mock_request.mockResolvedValue({
        status: 401,
        headers: { 'content-type': 'text/plain' },
        rawBody: Buffer.from('unauthorized'),
      });

      await expect(
        multi.speak({
          model: 'gemini-tts',
          input: 'Hello',
          extra: {},
        }),
      ).rejects.toThrow('all tokens rejected (401)');
      expect(mock_request).toHaveBeenCalledTimes(3);
    });
  });
});
