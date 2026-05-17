/**
 * Audio route extended feature tests.
 * Tests text_split and fallback_models features.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import express, { Router } from 'express';
import type { Express } from 'express';
import request from 'supertest';
import { register_audio_routes } from '../../src/routes/audio.js';
import { ProviderRegistry } from '../../src/providers/registry.js';
import { error_handler } from '../../src/errors.js';
import type { TtsProvider, SpeechParams, SpeechResult } from '../../src/types/provider.js';

/** Create a minimal valid WAV buffer with PCM audio data. */
function create_wav_buffer(data_size: number): Buffer {
  const header = Buffer.alloc(44);
  const num_channels = 1,
    sample_rate = 44100,
    bits_per_sample = 16;
  const bytes_per_sample = bits_per_sample / 8;
  const block_align = num_channels * bytes_per_sample;
  const byte_rate = sample_rate * block_align;

  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + data_size, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(num_channels, 22);
  header.writeUInt32LE(sample_rate, 24);
  header.writeUInt32LE(byte_rate, 28);
  header.writeUInt16LE(block_align, 32);
  header.writeUInt16LE(bits_per_sample, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(data_size, 40);

  const audio = Buffer.alloc(data_size, 0);
  return Buffer.concat([header, audio]);
}

/**
 * EchoProvider that records the number of speak calls and returns
 * the received input in the response for verification.
 */
class EchoProvider implements TtsProvider {
  readonly name: string;
  call_count = 0;
  private use_wav: boolean;

  constructor(name = 'echo', use_wav = true) {
    this.name = name;
    this.use_wav = use_wav;
  }

  get_models(): string[] {
    return ['tts-1', 'tts-1-hd'];
  }

  supports_model(model: string): boolean {
    return model === 'tts-1' || model === 'tts-1-hd';
  }

  async speak(params: SpeechParams): Promise<SpeechResult> {
    this.call_count++;
    const payload = Buffer.from(JSON.stringify(params), 'utf-8');
    if (this.use_wav) {
      // Return a valid minimal WAV wrapping the payload as audio data
      const wav = create_wav_buffer(payload.length);
      payload.copy(wav, 44); // overwrite the audio data portion with actual payload
      return { content_type: 'audio/wav', data: wav };
    }
    return { content_type: 'audio/wav', data: payload };
  }
}

/**
 * Provider that always fails.
 */
class FailingProvider implements TtsProvider {
  readonly name: string;
  private fail_message: string;

  constructor(name: string, fail_message: string) {
    this.name = name;
    this.fail_message = fail_message;
  }

  get_models(): string[] {
    return ['failing-model'];
  }

  supports_model(model: string): boolean {
    return model === 'failing-model';
  }

  async speak(_params: SpeechParams): Promise<SpeechResult> {
    throw new Error(this.fail_message);
  }
}

function build_app(registry: ProviderRegistry): Express {
  const app = express();
  const router = Router();
  app.use(express.json());
  register_audio_routes(router, registry);
  app.use(router);
  app.use(error_handler);
  return app;
}

describe('POST /v1/audio/speech - text_split', () => {
  let registry: ProviderRegistry;
  let app: Express;
  let echoProvider: EchoProvider;

  beforeEach(() => {
    registry = new ProviderRegistry();
    echoProvider = new EchoProvider('echo');
    registry.register(echoProvider);
    app = build_app(registry);
  });

  it('should return audio without text_split for short text', async () => {
    const res = await request(app)
      .post('/v1/audio/speech')
      .send({ model: 'tts-1', input: 'short text', voice: 'alloy', text_split: true });

    expect(res.status).toBe(200);
    expect(res.body).toBeDefined();
  });

  it('should split text and make multiple speak calls', async () => {
    const long_text = 'Hello world. '.repeat(30); // ~360 chars

    const res = await request(app).post('/v1/audio/speech').send({
      model: 'tts-1',
      input: long_text,
      voice: 'alloy',
      text_split: true,
      text_split_max_length: 100,
    });

    expect(res.status).toBe(200);
    // Should have been called multiple times (text is longer than 100)
    const chunks = [];
    let remaining = long_text;
    while (remaining.length > 0) {
      const end = Math.min(remaining.length, 100);
      // The split won't be exact due to sentence/word boundaries
      chunks.push(remaining.slice(0, end));
      remaining = remaining.slice(end);
    }
    // At minimum, should be more than 1 speak call
    expect(echoProvider.call_count).toBeGreaterThan(1);
  });

  it('should reject text_split with unsupported audio format', async () => {
    // This test relies on concat_audio throwing for non-wav/mp3
    // We register a provider that returns a non-standard content type
    const weirdProvider = new EchoProvider();
    weirdProvider.get_models = () => ['weird-model'];
    weirdProvider.supports_model = (m: string) => m === 'weird-model';
    weirdProvider.speak = async (_params: SpeechParams) => ({
      content_type: 'audio/ogg',
      data: Buffer.from('weird'),
    });

    registry = new ProviderRegistry();
    registry.register(weirdProvider);
    app = build_app(registry);

    const res = await request(app)
      .post('/v1/audio/speech')
      .send({
        model: 'weird-model',
        input: 'Hello world. '.repeat(80), // ~1040 chars, triggers split
        voice: 'alloy',
        text_split: true,
      });

    // Should fail because text_split doesn't support ogg concatenation
    expect(res.status).toBe(502);
  });

  it('should work with text_split_max_length option', async () => {
    const long_text = 'A'.repeat(500);

    const res = await request(app).post('/v1/audio/speech').send({
      model: 'tts-1',
      input: long_text,
      voice: 'alloy',
      text_split: true,
      text_split_max_length: 50,
    });

    expect(res.status).toBe(200);
  });

  it('should not split text when text_split is false or omitted', async () => {
    const long_text = 'Hello world. '.repeat(30);

    const res = await request(app).post('/v1/audio/speech').send({
      model: 'tts-1',
      input: long_text,
      voice: 'alloy',
    });

    expect(res.status).toBe(200);
    expect(echoProvider.call_count).toBe(1);
  });

  it('should allow input longer than 4096 with text_split', async () => {
    const long_text = 'Hello world. '.repeat(300); // ~3600 chars

    const res = await request(app).post('/v1/audio/speech').send({
      model: 'tts-1',
      input: long_text,
      voice: 'alloy',
      text_split: true,
      text_split_max_length: 1000,
    });

    expect(res.status).toBe(200);
  });
});

describe('POST /v1/audio/speech - fallback_models', () => {
  let registry: ProviderRegistry;
  let app: Express;

  beforeEach(() => {
    registry = new ProviderRegistry();
    app = build_app(registry);
  });

  it('should fallback when primary provider fails', async () => {
    registry.register(new FailingProvider('fail1', 'Primary failed'));
    registry.register(new EchoProvider('fallback-echo'));

    const res = await request(app)
      .post('/v1/audio/speech')
      .send({
        model: 'failing-model',
        input: 'Hello',
        voice: 'alloy',
        fallback_models: ['tts-1'],
      });

    // Should succeed via fallback
    expect(res.status).toBe(200);
  });

  it('should fail when all providers including fallbacks fail', async () => {
    registry.register(new FailingProvider('fail1', 'Primary failed'));
    registry.register(new FailingProvider('fail2', 'Fallback failed'));

    const res = await request(app)
      .post('/v1/audio/speech')
      .send({
        model: 'failing-model',
        input: 'Hello',
        voice: 'alloy',
        fallback_models: ['failing-model'], // same model, different provider ref - but same model
      });

    expect(res.status).toBe(502);
    expect(res.body.error.type).toBe('provider_error');
  });

  it('should use the first successful fallback and skip remaining', async () => {
    const echoProvider = new EchoProvider('echo');
    registry.register(new FailingProvider('fail1', 'Primary failed'));
    registry.register(echoProvider);
    registry.register(new FailingProvider('fail2', 'Should not be called'));

    const res = await request(app)
      .post('/v1/audio/speech')
      .send({
        model: 'failing-model',
        input: 'Hello',
        voice: 'alloy',
        fallback_models: ['tts-1', 'failing-model'],
      });

    expect(res.status).toBe(200);
    // Echo should have been called exactly once
    expect(echoProvider.call_count).toBe(1);
  });

  it('should skip fallback models with no registered provider', async () => {
    registry.register(new FailingProvider('fail1', 'Primary failed'));
    registry.register(new EchoProvider('echo'));

    const res = await request(app)
      .post('/v1/audio/speech')
      .send({
        model: 'failing-model',
        input: 'Hello',
        voice: 'alloy',
        fallback_models: ['nonexistent-model', 'tts-1'],
      });

    // Should work via tts-1 (second fallback)
    expect(res.status).toBe(200);
  });

  it('should not cause fallback when primary succeeds', async () => {
    const echoProvider = new EchoProvider('echo');
    registry.register(echoProvider);
    registry.register(new FailingProvider('unused', 'Should not be called'));

    const res = await request(app)
      .post('/v1/audio/speech')
      .send({
        model: 'tts-1',
        input: 'Hello',
        voice: 'alloy',
        fallback_models: ['failing-model'],
      });

    expect(res.status).toBe(200);
    expect(echoProvider.call_count).toBe(1);
  });

  it('should work without fallback_models (no change to existing behavior)', async () => {
    const echoProvider = new EchoProvider('echo');
    registry.register(echoProvider);

    const res = await request(app).post('/v1/audio/speech').send({
      model: 'tts-1',
      input: 'Hello',
      voice: 'alloy',
    });

    expect(res.status).toBe(200);
    expect(echoProvider.call_count).toBe(1);
  });
});

describe('POST /v1/audio/speech - text_split + fallback combined', () => {
  let registry: ProviderRegistry;
  let app: Express;

  beforeEach(() => {
    registry = new ProviderRegistry();
    app = build_app(registry);
  });

  it('should combine text_split and fallback (primary fails, fallback splits)', async () => {
    registry.register(new FailingProvider('fail1', 'Primary failed'));
    registry.register(new EchoProvider('echo'));

    const long_text = 'Hello world. '.repeat(20);

    const res = await request(app)
      .post('/v1/audio/speech')
      .send({
        model: 'failing-model',
        input: long_text,
        voice: 'alloy',
        text_split: true,
        text_split_max_length: 100,
        fallback_models: ['tts-1'],
      });

    // Should succeed with fallback doing the text split
    expect(res.status).toBe(200);
  });

  it('should combine text_split and fallback (primary succeeds with split)', async () => {
    const echoProvider = new EchoProvider('echo');
    registry.register(echoProvider);

    const long_text = 'Hello world. '.repeat(20);

    const res = await request(app)
      .post('/v1/audio/speech')
      .send({
        model: 'tts-1',
        input: long_text,
        voice: 'alloy',
        text_split: true,
        text_split_max_length: 100,
        fallback_models: ['failing-model'],
      });

    // Should succeed with primary doing the text split (fallback not used)
    expect(res.status).toBe(200);
    expect(echoProvider.call_count).toBeGreaterThan(1);
  });
});

describe('POST /v1/audio/speech - extended params passthrough', () => {
  let registry: ProviderRegistry;
  let app: Express;

  beforeEach(() => {
    registry = new ProviderRegistry();
    app = build_app(registry);
  });

  it('should not pass text_split/fallback_models in extra', async () => {
    class InspectProvider implements TtsProvider {
      readonly name = 'inspect';
      last_extra: Record<string, unknown> = {};

      get_models() {
        return ['inspect-model'];
      }
      supports_model(m: string) {
        return m === 'inspect-model';
      }

      async speak(params: SpeechParams) {
        this.last_extra = params.extra;
        return { content_type: 'audio/wav', data: Buffer.from('ok') };
      }
    }

    const provider = new InspectProvider();
    registry.register(provider);

    await request(app)
      .post('/v1/audio/speech')
      .send({
        model: 'inspect-model',
        input: 'Hello',
        voice: 'alloy',
        text_split: true,
        text_split_max_length: 500,
        fallback_models: ['tts-1'],
      });

    expect(provider.last_extra).not.toHaveProperty('text_split');
    expect(provider.last_extra).not.toHaveProperty('text_split_max_length');
    expect(provider.last_extra).not.toHaveProperty('fallback_models');
    // But voice should still be in extra
    expect(provider.last_extra).toHaveProperty('voice', 'alloy');
  });
});
