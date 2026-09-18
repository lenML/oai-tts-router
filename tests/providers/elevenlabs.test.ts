/**
 * ElevenLabs provider tests.
 * Mocks node-fetch to avoid real API calls.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ElevenlabsProvider } from '../../src/providers/elevenlabs.js';

const mock_fetch = vi.hoisted(() => vi.fn());
const mock_proxy_agent = vi.hoisted(() => vi.fn());

vi.mock('node-fetch', () => ({
  default: mock_fetch,
}));

vi.mock('proxy-agent', () => ({
  ProxyAgent: class {
    constructor(options: unknown) {
      mock_proxy_agent(options);
    }
  },
}));

function response_headers(values: Record<string, string>) {
  return {
    get: (name: string) => values[name.toLowerCase()] ?? null,
  };
}

function mock_response(
  body: Buffer,
  options?: {
    status?: number;
    content_type?: string;
  },
) {
  mock_fetch.mockResolvedValue({
    ok: (options?.status ?? 200) >= 200 && (options?.status ?? 200) < 300,
    status: options?.status ?? 200,
    headers: response_headers({
      'content-type': options?.content_type ?? 'audio/mpeg',
    }),
    arrayBuffer: () => Promise.resolve(body),
  });
}

describe('ElevenlabsProvider', () => {
  let provider: ElevenlabsProvider;

  beforeEach(() => {
    provider = new ElevenlabsProvider({
      keys: ['config-key-a', 'config-key-b'],
    });
    mock_fetch.mockReset();
    mock_proxy_agent.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('basic info', () => {
    it('should expose provider metadata', () => {
      expect(provider.name).toBe('elevenlabs');
      expect(provider.owned_by).toBe('elevenlabs');
      expect(provider.get_models()).toContain('elevenlabs');
      expect(provider.get_models()).toContain('eleven_multilingual_v2');
      expect(provider.supports_model('elevenlabs')).toBe(true);
      expect(provider.supports_model('eleven_v3')).toBe(true);
      expect(provider.supports_model('tts-1')).toBe(false);
    });

    it('should parse a comma-separated key string', () => {
      const parsed = new ElevenlabsProvider({ keys: 'key-a, key-b ,, key-c' });
      mock_response(Buffer.from('audio'));

      return parsed.speak({ model: 'elevenlabs', input: 'Hello', extra: {} }).then(() => {
        expect(mock_fetch.mock.calls[0][1].headers['xi-api-key']).toBe('key-a');
      });
    });
  });

  describe('schema validation', () => {
    it('should accept request-level keys and voice settings', () => {
      const result = provider.request_schema!.safeParse({
        model: 'elevenlabs',
        input: 'Hello',
        voice_id: 'voice-id',
        keys: ['key-a'],
        output_format: 'wav_44100',
        voice_settings: { stability: 0.4, speed: 1.1 },
      });

      expect(result.success).toBe(true);
    });

    it('should reject empty request-level key arrays', () => {
      const result = provider.request_schema!.safeParse({
        model: 'elevenlabs',
        input: 'Hello',
        keys: [],
      });

      expect(result.success).toBe(false);
    });

    it('should reject invalid output formats', () => {
      const result = provider.request_schema!.safeParse({
        model: 'elevenlabs',
        input: 'Hello',
        output_format: 'mp3_invalid',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('speak', () => {
    it('should call the official endpoint and map standard parameters', async () => {
      mock_response(Buffer.from('fake-audio'));

      const result = await provider.speak({
        model: 'elevenlabs',
        input: 'Hello world',
        extra: {
          voice_id: 'voice-123',
          model_id: 'eleven_v3',
          output_format: 'mp3_44100_128',
          language_code: 'en',
          speed: 1.2,
          seed: 42,
        },
      });

      expect(result.content_type).toBe('audio/mpeg');
      expect(result.data.toString()).toBe('fake-audio');

      const [url, options] = mock_fetch.mock.calls[0] as [string, Record<string, unknown>];
      expect(url).toBe(
        'https://api.elevenlabs.io/v1/text-to-speech/voice-123?output_format=mp3_44100_128',
      );
      expect(options.method).toBe('POST');
      expect((options.headers as Record<string, string>)['xi-api-key']).toBe('config-key-a');
      const body = JSON.parse(options.body as string);
      expect(body).toMatchObject({
        text: 'Hello world',
        model_id: 'eleven_v3',
        language_code: 'en',
        seed: 42,
        voice_settings: { speed: 1.2 },
      });
    });

    it('should prefer request keys and rotate after authentication failure', async () => {
      mock_fetch
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          headers: response_headers({ 'content-type': 'application/json' }),
          arrayBuffer: () => Promise.resolve(Buffer.from('invalid key')),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: response_headers({ 'content-type': 'audio/mpeg' }),
          arrayBuffer: () => Promise.resolve(Buffer.from('audio')),
        });

      const result = await provider.speak({
        model: 'elevenlabs',
        input: 'Hello',
        extra: { keys: ['request-key-a', 'request-key-b'] },
      });

      expect(result.data.toString()).toBe('audio');
      expect(mock_fetch).toHaveBeenCalledTimes(2);
      expect(mock_fetch.mock.calls[0][1].headers['xi-api-key']).toBe('request-key-a');
      expect(mock_fetch.mock.calls[1][1].headers['xi-api-key']).toBe('request-key-b');
    });

    it('should support the single api_key alias', async () => {
      mock_response(Buffer.from('audio'));

      await provider.speak({
        model: 'elevenlabs',
        input: 'Hello',
        extra: { api_key: 'single-request-key' },
      });

      expect(mock_fetch.mock.calls[0][1].headers['xi-api-key']).toBe('single-request-key');
    });

    it('should reject requests without a configured key', async () => {
      const no_key = new ElevenlabsProvider({});

      await expect(
        no_key.speak({ model: 'elevenlabs', input: 'Hello', extra: {} }),
      ).rejects.toMatchObject({
        status_code: 502,
        param: 'keys',
      });
      expect(mock_fetch).not.toHaveBeenCalled();
    });

    it('should preserve non-retryable upstream errors', async () => {
      mock_response(Buffer.from(JSON.stringify({ detail: [{ msg: 'voice not found' }] })), {
        status: 422,
        content_type: 'application/json',
      });

      await expect(
        provider.speak({ model: 'elevenlabs', input: 'Hello', extra: {} }),
      ).rejects.toMatchObject({
        status_code: 422,
      });
      expect(mock_fetch).toHaveBeenCalledTimes(1);
    });

    it('should retry on 429 and succeed', async () => {
      vi.useFakeTimers();
      mock_fetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          headers: response_headers({ 'content-type': 'application/json' }),
          arrayBuffer: () => Promise.resolve(Buffer.from('rate limited')),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: response_headers({ 'content-type': 'audio/mpeg' }),
          arrayBuffer: () => Promise.resolve(Buffer.from('audio')),
        });

      const promise = provider.speak({
        model: 'elevenlabs',
        input: 'Hello',
        extra: {},
      });
      await vi.advanceTimersByTimeAsync(1000);
      const result = await promise;

      expect(result.data.toString()).toBe('audio');
      expect(mock_fetch).toHaveBeenCalledTimes(2);
    });

    it('should return the correct PCM content type', async () => {
      mock_response(Buffer.from('pcm'), { content_type: 'application/octet-stream' });

      const result = await provider.speak({
        model: 'elevenlabs',
        input: 'Hello',
        extra: { output_format: 'pcm_24000' },
      });

      expect(result.content_type).toBe('audio/L16; rate=24000; channels=1');
    });

    it('should pass a configured proxy to node-fetch', async () => {
      const proxied = new ElevenlabsProvider({
        keys: ['key'],
        proxy: 'http://proxy.example.com:8080',
      });
      mock_response(Buffer.from('audio'));

      await proxied.speak({ model: 'elevenlabs', input: 'Hello', extra: {} });

      expect(mock_proxy_agent).toHaveBeenCalled();
      expect(mock_fetch.mock.calls[0][1].agent).toBeDefined();
    });
  });
});
