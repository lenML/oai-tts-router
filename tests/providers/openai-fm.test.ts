/**
 * OpenAI.fm provider tests.
 * Mocks cuimp to avoid actual HTTP calls to openai.fm.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { OpenaiFmProvider } from '../../src/providers/openai-fm.js';
import { OpenAiError } from '../../src/errors.js';
import { OPENAI_ERROR_CODE } from '../../src/types/openai.js';

// Hoist mocks so vi.mock factory picks them up
const { mockRequest, mockCreateCuimpHttp } = vi.hoisted(() => {
  const r = vi.fn();
  const c = vi.fn(() => ({ request: r }));
  return { mockRequest: r, mockCreateCuimpHttp: c };
});

vi.mock('cuimp', () => ({
  createCuimpHttp: mockCreateCuimpHttp,
}));

describe('OpenaiFmProvider', () => {
  let provider: OpenaiFmProvider;

  beforeEach(() => {
    process.env['HTTP_PROXY'] = 'http://proxy.example.com:8080';
    process.env['HTTPS_PROXY'] = 'http://proxy.example.com:8080';
    provider = new OpenaiFmProvider();
    mockRequest.mockReset();
    mockCreateCuimpHttp.mockClear();
  });

  afterEach(() => {
    delete process.env['HTTP_PROXY'];
    delete process.env['HTTPS_PROXY'];
  });

  describe('basic info', () => {
    it('should have correct name', () => {
      expect(provider.name).toBe('openai-fm');
    });

    it('should have owned_by set to openai-fm', () => {
      expect(provider.owned_by).toBe('openai-fm');
    });

    it('should return models list', () => {
      expect(provider.get_models()).toEqual(['openai-fm-tts']);
    });

    it('should support openai-fm-tts model', () => {
      expect(provider.supports_model('openai-fm-tts')).toBe(true);
    });

    it('should not support unknown models', () => {
      expect(provider.supports_model('tts-1')).toBe(false);
    });
  });

  describe('voices', () => {
    it('should return the 11 openai.fm voice names', () => {
      const voices = provider.get_model_voices('openai-fm-tts');
      expect(voices).toEqual([
        'alloy',
        'ash',
        'ballad',
        'coral',
        'echo',
        'fable',
        'nova',
        'onyx',
        'sage',
        'shimmer',
        'verse',
      ]);
    });
  });

  describe('request schema', () => {
    it('should have a request_schema that extends tts_request_base', () => {
      expect(provider.request_schema).toBeDefined();
    });

    it('should accept valid request with all fields', () => {
      const result = provider.request_schema!.parse({
        model: 'openai-fm-tts',
        input: 'Hello world',
        voice: 'alloy',
        response_format: 'mp3',
        instructions: 'Speak slowly',
      });

      expect(result.model).toBe('openai-fm-tts');
      expect(result.input).toBe('Hello world');
      expect(result.voice).toBe('alloy');
      expect(result.response_format).toBe('mp3');
      expect(result.instructions).toBe('Speak slowly');
    });

    it('should accept request without optional fields', () => {
      const result = provider.request_schema!.parse({
        model: 'openai-fm-tts',
        input: 'Hello',
        voice: 'nova',
      });

      expect(result.voice).toBe('nova');
      expect(result.response_format).toBeUndefined();
      expect(result.instructions).toBeUndefined();
    });

    it('should reject missing voice', () => {
      expect(() =>
        provider.request_schema!.parse({
          model: 'openai-fm-tts',
          input: 'Hello',
        }),
      ).toThrow();
    });

    it('should reject empty voice', () => {
      expect(() =>
        provider.request_schema!.parse({
          model: 'openai-fm-tts',
          input: 'Hello',
          voice: '',
        }),
      ).toThrow();
    });

    it('should reject invalid response_format', () => {
      expect(() =>
        provider.request_schema!.parse({
          model: 'openai-fm-tts',
          input: 'Hello',
          voice: 'alloy',
          response_format: 'flac',
        }),
      ).toThrow();
    });

    it('should reject missing model', () => {
      expect(() =>
        provider.request_schema!.parse({
          input: 'Hello',
          voice: 'alloy',
        }),
      ).toThrow();
    });

    it('should reject empty input', () => {
      expect(() =>
        provider.request_schema!.parse({
          model: 'openai-fm-tts',
          input: '',
          voice: 'alloy',
        }),
      ).toThrow();
    });
  });

  describe('speak', () => {
    const mockAudioData = Buffer.from('fake-wav-data');

    function mockSuccessResponse(overrides?: {
      status?: number;
      headers?: Record<string, string>;
      rawBody?: Buffer;
    }) {
      mockRequest.mockResolvedValue({
        status: overrides?.status ?? 200,
        headers: overrides?.headers ?? { 'content-type': 'audio/wav' },
        rawBody: overrides?.rawBody ?? mockAudioData,
      });
    }

    it('should return wav audio on successful request (default format)', async () => {
      mockSuccessResponse();

      const result = await provider.speak({
        model: 'openai-fm-tts',
        input: 'Hello world',
        extra: { voice: 'alloy' },
      });

      expect(result.content_type).toBe('audio/wav');
      expect(result.data).toEqual(mockAudioData);
    });

    it('should return mp3 when response_format is mp3', async () => {
      mockSuccessResponse({ headers: { 'content-type': 'audio/mpeg' } });

      const result = await provider.speak({
        model: 'openai-fm-tts',
        input: 'Hello mp3',
        extra: { voice: 'alloy', response_format: 'mp3' },
      });

      expect(result.content_type).toBe('audio/mpeg');
      expect(result.data).toEqual(mockAudioData);
    });

    it('should detect mp3 format from content-type when wav requested', async () => {
      mockSuccessResponse({ headers: { 'content-type': 'audio/mpeg; charset=utf-8' } });

      const result = await provider.speak({
        model: 'openai-fm-tts',
        input: 'Hello',
        extra: { voice: 'alloy', response_format: 'wav' },
      });

      expect(result.content_type).toBe('audio/mpeg');
    });

    it('should pass instructions as prompt field in request body', async () => {
      mockSuccessResponse();

      await provider.speak({
        model: 'openai-fm-tts',
        input: 'Hello',
        extra: { voice: 'alloy', instructions: 'Speak like a pirate' },
      });

      const callBody = mockRequest.mock.calls[0][0];
      expect(callBody.data).toContain('prompt=Speak+like+a+pirate');
    });

    it('should include generation UUID in request body', async () => {
      mockSuccessResponse();

      await provider.speak({
        model: 'openai-fm-tts',
        input: 'Hello',
        extra: { voice: 'alloy' },
      });

      const callBody = mockRequest.mock.calls[0][0];
      expect(callBody.data).toContain('generation=');
      const uuidMatch = callBody.data.match(/generation=([^&]+)/);
      expect(uuidMatch).not.toBeNull();
      expect(uuidMatch![1]).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it('should send request to correct URL', async () => {
      mockSuccessResponse();

      await provider.speak({
        model: 'openai-fm-tts',
        input: 'Hello',
        extra: { voice: 'alloy' },
      });

      const callBody = mockRequest.mock.calls[0][0];
      expect(callBody.url).toBe('https://www.openai.fm/api/generate');
      expect(callBody.method).toBe('POST');
    });

    it('should set browser-like headers on the request', async () => {
      mockSuccessResponse();

      await provider.speak({
        model: 'openai-fm-tts',
        input: 'Hello',
        extra: { voice: 'alloy' },
      });

      const callBody = mockRequest.mock.calls[0][0];
      expect(callBody.headers['User-Agent']).toContain('Chrome/124');
      expect(callBody.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
      expect(callBody.headers['sec-ch-ua']).toContain('Chromium');
    });

    it('should throw OpenAiError when voice is missing in extra', async () => {
      await expect(
        provider.speak({
          model: 'openai-fm-tts',
          input: 'Hello',
          extra: {},
        }),
      ).rejects.toThrow(OpenAiError);

      expect(mockRequest).not.toHaveBeenCalled();
    });

    it('should throw OpenAiError for unsupported voice', async () => {
      let caught: unknown;
      try {
        await provider.speak({
          model: 'openai-fm-tts',
          input: 'Hello',
          extra: { voice: 'invalid-voice' },
        });
      } catch (e) {
        caught = e;
      }

      expect(caught).toBeInstanceOf(OpenAiError);
      expect((caught as OpenAiError).code).toBe(OPENAI_ERROR_CODE.VOICE_NOT_SUPPORTED);
      expect((caught as OpenAiError).status_code).toBe(400);
      expect(mockRequest).not.toHaveBeenCalled();
    });

    it('should retry on 429 and succeed', async () => {
      vi.useFakeTimers();
      try {
        mockRequest
          .mockResolvedValueOnce({ status: 429, headers: {}, rawBody: Buffer.from('') })
          .mockResolvedValueOnce({
            status: 200,
            headers: { 'content-type': 'audio/wav' },
            rawBody: mockAudioData,
          });

        const speakPromise = provider.speak({
          model: 'openai-fm-tts',
          input: 'Hello',
          extra: { voice: 'alloy' },
        });

        await vi.advanceTimersToNextTimerAsync();
        const result = await speakPromise;

        expect(result.content_type).toBe('audio/wav');
        expect(mockRequest).toHaveBeenCalledTimes(2);
      } finally {
        vi.useRealTimers();
      }
    });

    it('should retry on 5xx and succeed', async () => {
      vi.useFakeTimers();
      try {
        mockRequest
          .mockResolvedValueOnce({ status: 503, headers: {}, rawBody: Buffer.from('') })
          .mockResolvedValueOnce({
            status: 200,
            headers: { 'content-type': 'audio/wav' },
            rawBody: mockAudioData,
          });

        const speakPromise = provider.speak({
          model: 'openai-fm-tts',
          input: 'Hello',
          extra: { voice: 'alloy' },
        });

        await vi.advanceTimersToNextTimerAsync();
        const result = await speakPromise;

        expect(result.content_type).toBe('audio/wav');
        expect(mockRequest).toHaveBeenCalledTimes(2);
      } finally {
        vi.useRealTimers();
      }
    });

    it('should throw after max retries for persistent 429', async () => {
      vi.useFakeTimers();
      try {
        mockRequest.mockResolvedValue({ status: 429, headers: {}, rawBody: Buffer.from('') });

        const speakPromise = provider.speak({
          model: 'openai-fm-tts',
          input: 'Hello',
          extra: { voice: 'alloy' },
        });
        speakPromise.catch(() => {}); // suppress unhandled rejection

        for (let i = 0; i < 3; i++) {
          await vi.advanceTimersToNextTimerAsync();
        }

        await expect(speakPromise).rejects.toThrow(OpenAiError);
        expect(mockRequest).toHaveBeenCalledTimes(4);
      } finally {
        vi.useRealTimers();
      }
    });

    it('should throw on non-retryable HTTP status (400)', async () => {
      vi.useFakeTimers();
      try {
        mockRequest.mockResolvedValue({ status: 400, headers: {}, rawBody: Buffer.from('') });

        const speakPromise = provider.speak({
          model: 'openai-fm-tts',
          input: 'Hello',
          extra: { voice: 'alloy' },
        });
        speakPromise.catch(() => {}); // suppress unhandled rejection

        for (let i = 0; i < 3; i++) {
          await vi.advanceTimersToNextTimerAsync();
        }

        await expect(speakPromise).rejects.toThrow(OpenAiError);
        expect(mockRequest).toHaveBeenCalledTimes(4);
      } finally {
        vi.useRealTimers();
      }
    });

    it('should clear proxy env vars during request and restore them in finally', async () => {
      vi.useFakeTimers();
      try {
        mockSuccessResponse();

        expect(process.env['HTTP_PROXY']).toBe('http://proxy.example.com:8080');
        expect(process.env['HTTPS_PROXY']).toBe('http://proxy.example.com:8080');

        const result = await provider.speak({
          model: 'openai-fm-tts',
          input: 'Hello',
          extra: { voice: 'alloy' },
        });

        expect(result.content_type).toBe('audio/wav');
        expect(process.env['HTTP_PROXY']).toBe('http://proxy.example.com:8080');
        expect(process.env['HTTPS_PROXY']).toBe('http://proxy.example.com:8080');
      } finally {
        vi.useRealTimers();
      }
    });

    it('should restore proxy env vars even on failure', async () => {
      vi.useFakeTimers();
      try {
        mockRequest.mockRejectedValue(new Error('Network error'));

        const speakPromise = provider.speak({
          model: 'openai-fm-tts',
          input: 'Hello',
          extra: { voice: 'alloy' },
        });
        speakPromise.catch(() => {}); // suppress unhandled rejection

        for (let i = 0; i < 3; i++) {
          await vi.advanceTimersToNextTimerAsync();
        }

        await expect(speakPromise).rejects.toThrow(OpenAiError);

        expect(process.env['HTTP_PROXY']).toBe('http://proxy.example.com:8080');
        expect(process.env['HTTPS_PROXY']).toBe('http://proxy.example.com:8080');
      } finally {
        vi.useRealTimers();
      }
    });

    it('should create a new cuimp client on each speak call', async () => {
      mockSuccessResponse();
      await provider.speak({
        model: 'openai-fm-tts',
        input: 'First',
        extra: { voice: 'alloy' },
      });

      mockSuccessResponse();
      await provider.speak({
        model: 'openai-fm-tts',
        input: 'Second',
        extra: { voice: 'alloy' },
      });

      expect(mockCreateCuimpHttp).toHaveBeenCalledTimes(2);
    });

    it('should accept custom base_url from config', async () => {
      const customProvider = new OpenaiFmProvider({
        base_url: 'http://localhost:3000',
      } as Record<string, unknown>);

      mockSuccessResponse();

      await customProvider.speak({
        model: 'openai-fm-tts',
        input: 'Hello',
        extra: { voice: 'alloy' },
      });

      const callBody = mockRequest.mock.calls[0][0];
      expect(callBody.url).toBe('http://localhost:3000/api/generate');
    });

    it('should apply exponential backoff with random jitter', async () => {
      vi.useFakeTimers();
      const sleepSpy = vi.spyOn(globalThis, 'setTimeout');

      try {
        mockRequest
          .mockResolvedValueOnce({ status: 429, headers: {}, rawBody: Buffer.from('') })
          .mockResolvedValueOnce({ status: 429, headers: {}, rawBody: Buffer.from('') })
          .mockResolvedValueOnce({
            status: 200,
            headers: { 'content-type': 'audio/wav' },
            rawBody: mockAudioData,
          });

        const speakPromise = provider.speak({
          model: 'openai-fm-tts',
          input: 'Hello',
          extra: { voice: 'alloy' },
        });

        for (let i = 0; i < 3; i++) {
          await vi.advanceTimersToNextTimerAsync();
        }

        await speakPromise;

        expect(mockRequest).toHaveBeenCalledTimes(3);
        expect(sleepSpy).toHaveBeenCalledTimes(2);
      } finally {
        vi.useRealTimers();
        sleepSpy.mockRestore();
      }
    });
  });
});