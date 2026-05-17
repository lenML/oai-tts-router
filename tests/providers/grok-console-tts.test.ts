/**
 * Grok Console TTS provider tests.
 * Mocks cuimp to avoid actual network calls.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GrokTtsProvider } from '../../src/providers/grok-console-tts.js';

const mock_request = vi.hoisted(() => vi.fn());

vi.mock('cuimp', () => ({
  createCuimpHttp: vi.fn(() => ({
    request: mock_request,
  })),
}));

function mock_success(body: Buffer, content_type = 'audio/mpeg', status = 200) {
  mock_request.mockResolvedValue({
    status,
    headers: { 'content-type': content_type },
    rawBody: body,
  });
}

describe('GrokTtsProvider', () => {
  let provider: GrokTtsProvider;

  beforeEach(() => {
    provider = new GrokTtsProvider({
      cookies: ['sso=abc; sso-rw=def'],
    });
    mock_request.mockReset();
  });

  describe('basic info', () => {
    it('should have correct name', () => {
      expect(provider.name).toBe('grok-console-tts');
    });

    it('should have owned_by set to x-ai', () => {
      expect(provider.owned_by).toBe('x-ai');
    });

    it('should return models list', () => {
      expect(provider.get_models()).toEqual(['grok-console-tts']);
    });

    it('should support grok-console-tts model', () => {
      expect(provider.supports_model('grok-console-tts')).toBe(true);
    });

    it('should not support unknown models', () => {
      expect(provider.supports_model('tts-1')).toBe(false);
    });

    it('should return supported voices', () => {
      const voices = provider.get_model_voices('grok-console-tts');
      expect(voices).toEqual(['eve', 'ara', 'rex', 'sal', 'leo']);
    });
  });

  describe('constructor cookie parsing', () => {
    it('should accept array of cookies', () => {
      const p = new GrokTtsProvider({
        cookies: ['cookie1', 'cookie2', 'cookie3'],
      });
      expect(p.get_models()).toEqual(['grok-console-tts']);
    });

    it('should accept a single cookie string', () => {
      const p = new GrokTtsProvider({
        cookies: 'sso=single; key=val',
      });
      expect(p.get_models()).toEqual(['grok-console-tts']);
    });

    it('should filter empty cookies', () => {
      const p = new GrokTtsProvider({
        cookies: ['valid', '', null, 'also-valid'],
      });
      expect(p.get_models()).toEqual(['grok-console-tts']);
    });

    it('should default to empty array when no cookies provided', () => {
      const p = new GrokTtsProvider({});
      expect(p.get_models()).toEqual(['grok-console-tts']);
    });
  });

  describe('schema validation', () => {
    it('should accept request with only model and input', () => {
      const result = provider.request_schema!.safeParse({
        model: 'grok-console-tts',
        input: 'Hello world',
      });
      expect(result.success).toBe(true);
    });

    it('should accept voice parameter', () => {
      const result = provider.request_schema!.safeParse({
        model: 'grok-console-tts',
        input: 'Hello',
        voice: 'rex',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.data as Record<string, unknown>).voice).toBe('rex');
      }
    });

    it('should accept codec parameter', () => {
      const result = provider.request_schema!.safeParse({
        model: 'grok-console-tts',
        input: 'Hello',
        codec: 'pcm',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid codec', () => {
      const result = provider.request_schema!.safeParse({
        model: 'grok-console-tts',
        input: 'Hello',
        codec: 'invalid',
      });
      expect(result.success).toBe(false);
    });

    it('should accept language parameter', () => {
      const result = provider.request_schema!.safeParse({
        model: 'grok-console-tts',
        input: 'Hello',
        language: 'zh-CN',
      });
      expect(result.success).toBe(true);
    });

    it('should accept sample_rate parameter', () => {
      const result = provider.request_schema!.safeParse({
        model: 'grok-console-tts',
        input: 'Hello',
        sample_rate: 48000,
      });
      expect(result.success).toBe(true);
    });

    it('should reject non-positive sample_rate', () => {
      const result = provider.request_schema!.safeParse({
        model: 'grok-console-tts',
        input: 'Hello',
        sample_rate: -1,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('speak', () => {
    it('should return audio/mpeg for mp3 codec', async () => {
      mock_success(Buffer.from('fake-mp3-data'));

      const result = await provider.speak({
        model: 'grok-console-tts',
        input: 'Hello world',
        extra: {},
      });

      expect(result.content_type).toBe('audio/mpeg');
      expect(result.data.toString()).toBe('fake-mp3-data');
    });

    it('should pass voice from extra to request', async () => {
      mock_success(Buffer.from('audio'));

      await provider.speak({
        model: 'grok-console-tts',
        input: 'Hello',
        extra: { voice: 'rex' },
      });

      const call_body = JSON.parse(mock_request.mock.calls[0][0].data);
      expect(call_body.voice_id).toBe('rex');
    });

    it('should default to eve voice', async () => {
      mock_success(Buffer.from('audio'));

      await provider.speak({
        model: 'grok-console-tts',
        input: 'Hello',
        extra: {},
      });

      const call_body = JSON.parse(mock_request.mock.calls[0][0].data);
      expect(call_body.voice_id).toBe('eve');
    });

    it('should pass through any voice value', async () => {
      mock_success(Buffer.from('audio'));
      await provider.speak({
        model: 'grok-console-tts',
        input: 'test',
        extra: { voice: 'custom-voice' },
      });
      const call_body = JSON.parse(mock_request.mock.calls[0][0].data);
      expect(call_body.voice_id).toBe('custom-voice');
    });

    it('should include output_format when codec is not mp3', async () => {
      mock_success(Buffer.from('pcm-data'), 'audio/L16');

      await provider.speak({
        model: 'grok-console-tts',
        input: 'Hello',
        extra: { codec: 'pcm', sample_rate: 48000 },
      });

      const call_body = JSON.parse(mock_request.mock.calls[0][0].data);
      expect(call_body.output_format).toEqual({ codec: 'pcm', sample_rate: 48000 });
    });

    it('should not include output_format for default params', async () => {
      mock_success(Buffer.from('mp3-data'));

      await provider.speak({
        model: 'grok-console-tts',
        input: 'Hello',
        extra: {},
      });

      const call_body = JSON.parse(mock_request.mock.calls[0][0].data);
      expect(call_body.output_format).toBeUndefined();
    });

    it('should set cookie header from config', async () => {
      mock_success(Buffer.from('audio'));

      await provider.speak({
        model: 'grok-console-tts',
        input: 'Hello',
        extra: {},
      });

      const headers = mock_request.mock.calls[0][0].headers;
      expect(headers.cookie).toBe('sso=abc; sso-rw=def');
    });

    it('should return correct content type for PCM', async () => {
      mock_success(Buffer.from('pcm-data'), 'audio/L16');

      const result = await provider.speak({
        model: 'grok-console-tts',
        input: 'Hello',
        extra: { codec: 'pcm', sample_rate: 48000 },
      });

      expect(result.content_type).toBe('audio/L16; rate=48000; channels=1');
    });

    it('should throw if no cookies configured', async () => {
      const p = new GrokTtsProvider({});
      await expect(
        p.speak({
          model: 'grok-console-tts',
          input: 'test',
          extra: {},
        }),
      ).rejects.toThrow('No cookies configured');
    });

    it('should include text_normalization in body', async () => {
      mock_success(Buffer.from('audio'));

      await provider.speak({
        model: 'grok-console-tts',
        input: 'Hello',
        extra: {},
      });

      const call_body = JSON.parse(mock_request.mock.calls[0][0].data);
      expect(call_body.text_normalization).toBe(true);
    });

    it('should use per-request cookie from extra when provided', async () => {
      mock_success(Buffer.from('audio'));
      await provider.speak({
        model: 'grok-console-tts',
        input: 'Hello',
        extra: { cookie: 'req-cookie=val' },
      });
      const headers = mock_request.mock.calls[0][0].headers;
      expect(headers.cookie).toBe('req-cookie=val');
    });

    it('should skip retry when using per-request cookie', async () => {
      mock_request.mockResolvedValue({
        status: 429,
        headers: { 'content-type': 'text/html' },
        rawBody: Buffer.from('rate limited'),
      });

      await expect(
        provider.speak({
          model: 'grok-console-tts',
          input: 'Hello',
          extra: { cookie: 'req-cookie=val' },
        }),
      ).rejects.toThrow('grok-console-tts returned 429');
      expect(mock_request).toHaveBeenCalledTimes(1);
    });

    it('should fall back to config cookie when no per-request cookie given', async () => {
      mock_success(Buffer.from('audio'));
      await provider.speak({
        model: 'grok-console-tts',
        input: 'Hello',
        extra: {},
      });
      const headers = mock_request.mock.calls[0][0].headers;
      expect(headers.cookie).toBe('sso=abc; sso-rw=def');
    });
  });

  describe('retry logic', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('should retry on 429 and succeed', async () => {
      vi.useFakeTimers();
      mock_request
        .mockResolvedValueOnce({
          status: 429,
          headers: { 'content-type': 'text/html' },
          rawBody: Buffer.from('rate limited'),
        })
        .mockResolvedValueOnce({
          status: 200,
          headers: { 'content-type': 'audio/mpeg' },
          rawBody: Buffer.from('audio-data'),
        });

      const promise = provider.speak({
        model: 'grok-console-tts',
        input: 'Hello',
        extra: {},
      });
      promise.catch(() => {}); // suppress unhandled rejection

      await vi.advanceTimersByTimeAsync(3000);
      const result = await promise;

      expect(result.content_type).toBe('audio/mpeg');
      expect(result.data.toString()).toBe('audio-data');
      expect(mock_request).toHaveBeenCalledTimes(2);
    });

    it('should retry on 500 and succeed', async () => {
      vi.useFakeTimers();
      mock_request
        .mockResolvedValueOnce({
          status: 500,
          headers: { 'content-type': 'text/html' },
          rawBody: Buffer.from('server error'),
        })
        .mockResolvedValueOnce({
          status: 200,
          headers: { 'content-type': 'audio/mpeg' },
          rawBody: Buffer.from('audio-data'),
        });

      const promise = provider.speak({
        model: 'grok-console-tts',
        input: 'Hello',
        extra: {},
      });
      promise.catch(() => {}); // suppress unhandled rejection

      await vi.advanceTimersByTimeAsync(3000);
      const result = await promise;

      expect(result.content_type).toBe('audio/mpeg');
      expect(mock_request).toHaveBeenCalledTimes(2);
    });

    it('should retry on 503 and succeed', async () => {
      vi.useFakeTimers();
      mock_request
        .mockResolvedValueOnce({
          status: 503,
          headers: { 'content-type': 'text/html' },
          rawBody: Buffer.from('service unavailable'),
        })
        .mockResolvedValueOnce({
          status: 200,
          headers: { 'content-type': 'audio/mpeg' },
          rawBody: Buffer.from('audio-data'),
        });

      const promise = provider.speak({
        model: 'grok-console-tts',
        input: 'Hello',
        extra: {},
      });
      promise.catch(() => {}); // suppress unhandled rejection

      await vi.advanceTimersByTimeAsync(3000);
      const result = await promise;

      expect(result.content_type).toBe('audio/mpeg');
      expect(mock_request).toHaveBeenCalledTimes(2);
    });

    it('should throw after exhausting all retries on 429', async () => {
      vi.useFakeTimers();
      mock_request.mockResolvedValue({
        status: 429,
        headers: { 'content-type': 'text/html' },
        rawBody: Buffer.from('rate limited'),
      });

      const promise = provider.speak({
        model: 'grok-console-tts',
        input: 'Hello',
        extra: {},
      });
      promise.catch(() => {}); // suppress unhandled rejection

      await vi.advanceTimersByTimeAsync(16000);
      await expect(promise).rejects.toThrow('after 3 retries');
    });

    it('should retry on network error and succeed', async () => {
      vi.useFakeTimers();
      mock_request.mockRejectedValueOnce(new Error('Network failure')).mockResolvedValueOnce({
        status: 200,
        headers: { 'content-type': 'audio/mpeg' },
        rawBody: Buffer.from('audio-data'),
      });

      const promise = provider.speak({
        model: 'grok-console-tts',
        input: 'Hello',
        extra: {},
      });
      promise.catch(() => {}); // suppress unhandled rejection

      await vi.advanceTimersByTimeAsync(3000);
      const result = await promise;

      expect(result.content_type).toBe('audio/mpeg');
      expect(result.data.toString()).toBe('audio-data');
      expect(mock_request).toHaveBeenCalledTimes(2);
    });

    it('should throw on network error after exhausting retries', async () => {
      vi.useFakeTimers();
      mock_request.mockRejectedValue(new Error('Persistent failure'));

      const promise = provider.speak({
        model: 'grok-console-tts',
        input: 'Hello',
        extra: {},
      });
      promise.catch(() => {}); // suppress unhandled rejection

      await vi.advanceTimersByTimeAsync(16000);
      await expect(promise).rejects.toThrow('Persistent failure');
    });

    it('should switch cookies on retry when multiple cookies available', async () => {
      vi.useFakeTimers();
      const multi_cookie_provider = new GrokTtsProvider({
        cookies: ['cookie-a', 'cookie-b', 'cookie-c'],
      });

      mock_request
        .mockResolvedValueOnce({
          status: 429,
          headers: { 'content-type': 'text/html' },
          rawBody: Buffer.from('rate limited'),
        })
        .mockResolvedValueOnce({
          status: 200,
          headers: { 'content-type': 'audio/mpeg' },
          rawBody: Buffer.from('audio-data'),
        });

      const promise = multi_cookie_provider.speak({
        model: 'grok-console-tts',
        input: 'Hello',
        extra: {},
      });
      await vi.advanceTimersByTimeAsync(3000);
      const result = await promise;

      expect(result.content_type).toBe('audio/mpeg');
      expect(mock_request).toHaveBeenCalledTimes(2);

      const first_cookie = mock_request.mock.calls[0][0].headers.cookie;
      const second_cookie = mock_request.mock.calls[1][0].headers.cookie;
      expect(first_cookie).not.toBe(second_cookie);
    });

    it('should not retry on 400 error', async () => {
      mock_request.mockResolvedValue({
        status: 400,
        headers: { 'content-type': 'application/json' },
        rawBody: Buffer.from(JSON.stringify({ error: 'bad request' })),
      });

      await expect(
        provider.speak({
          model: 'grok-console-tts',
          input: 'Hello',
          extra: {},
        }),
      ).rejects.toThrow('HTTP 400');
    });

    it('should immediately retry with next cookie on 401', async () => {
      const multi = new GrokTtsProvider({
        cookies: ['cookie-a', 'cookie-b'],
      });
      mock_request
        .mockResolvedValueOnce({
          status: 401,
          headers: { 'content-type': 'text/html' },
          rawBody: Buffer.from('unauthorized'),
        })
        .mockResolvedValueOnce({
          status: 200,
          headers: { 'content-type': 'audio/mpeg' },
          rawBody: Buffer.from('audio-data'),
        });

      const result = await multi.speak({
        model: 'grok-console-tts',
        input: 'Hello',
        extra: {},
      });

      expect(result.content_type).toBe('audio/mpeg');
      expect(result.data.toString()).toBe('audio-data');
      expect(mock_request).toHaveBeenCalledTimes(2);
      const first = mock_request.mock.calls[0][0].headers.cookie;
      const second = mock_request.mock.calls[1][0].headers.cookie;
      expect(first).not.toBe(second);
    });

    it('should fail immediately on 401 when only one cookie configured', async () => {
      mock_request.mockResolvedValue({
        status: 401,
        headers: { 'content-type': 'text/html' },
        rawBody: Buffer.from('unauthorized'),
      });

      await expect(
        provider.speak({
          model: 'grok-console-tts',
          input: 'Hello',
          extra: {},
        }),
      ).rejects.toThrow('all cookies rejected (401)');
      expect(mock_request).toHaveBeenCalledTimes(1);
    });

    it('should fail when all cookies return 401', async () => {
      const multi = new GrokTtsProvider({
        cookies: ['cookie-a', 'cookie-b', 'cookie-c'],
      });
      mock_request.mockResolvedValue({
        status: 401,
        headers: { 'content-type': 'text/html' },
        rawBody: Buffer.from('unauthorized'),
      });

      await expect(
        multi.speak({
          model: 'grok-console-tts',
          input: 'Hello',
          extra: {},
        }),
      ).rejects.toThrow('all cookies rejected (401)');
      expect(mock_request).toHaveBeenCalledTimes(3);
    });
  });
});
