/**
 * Audio route tests.
 * Tests request validation via zod schemas, provider routing, and parameter passthrough.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import express, { Router } from 'express';
import type { Express } from 'express';
import request from 'supertest';
import { register_audio_routes } from '../../src/routes/audio.js';
import { ProviderRegistry } from '../../src/providers/registry.js';
import { error_handler } from '../../src/errors.js';
import { openai_tts_schema } from '../../src/types/openai.js';
import type { TtsProvider, SpeechParams, SpeechResult } from '../../src/types/provider.js';
import type { z } from 'zod';

/**
 * EchoProvider mirrors back the received params in the response body.
 * Uses the OpenAI schema to validate incoming requests.
 */
class EchoProvider implements TtsProvider {
  readonly name = 'echo';
  request_schema: z.ZodType<Record<string, unknown>> = openai_tts_schema;

  get_models(): string[] {
    return ['tts-1', 'tts-1-hd'];
  }

  supports_model(model: string): boolean {
    return model === 'tts-1' || model === 'tts-1-hd';
  }

  async speak(params: SpeechParams): Promise<SpeechResult> {
    const data = Buffer.from(JSON.stringify(params), 'utf-8');
    return { content_type: 'audio/mpeg', data };
  }
}

/**
 * MinimalProvider accepts only model and input (no extra schema).
 */
class MinimalProvider implements TtsProvider {
  readonly name = 'minimal';

  get_models(): string[] {
    return ['minimal-model'];
  }

  supports_model(model: string): boolean {
    return model === 'minimal-model';
  }

  async speak(params: SpeechParams): Promise<SpeechResult> {
    const data = Buffer.from(JSON.stringify(params), 'utf-8');
    return { content_type: 'audio/wav', data };
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

describe('POST /v1/audio/speech', () => {
  let registry: ProviderRegistry;
  let app: Express;

  beforeEach(() => {
    registry = new ProviderRegistry();
    registry.register(new EchoProvider());
    app = build_app(registry);
  });

  describe('base validation', () => {
    it('should reject empty body', async () => {
      const res = await request(app)
        .post('/v1/audio/speech')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.type).toBe('invalid_request_error');
    });

    it('should reject missing model', async () => {
      const res = await request(app)
        .post('/v1/audio/speech')
        .send({ input: 'hello', voice: 'alloy' });

      expect(res.status).toBe(400);
      expect(res.body.error.param).toBe('model');
    });

    it('should reject empty model', async () => {
      const res = await request(app)
        .post('/v1/audio/speech')
        .send({ model: '', input: 'hello', voice: 'alloy' });

      expect(res.status).toBe(400);
      expect(res.body.error.param).toBe('model');
    });

    it('should reject missing input', async () => {
      const res = await request(app)
        .post('/v1/audio/speech')
        .send({ model: 'tts-1', voice: 'alloy' });

      expect(res.status).toBe(400);
      expect(res.body.error.param).toBe('input');
    });

    it('should reject empty input', async () => {
      const res = await request(app)
        .post('/v1/audio/speech')
        .send({ model: 'tts-1', input: '', voice: 'alloy' });

      expect(res.status).toBe(400);
      expect(res.body.error.param).toBe('input');
    });

    it('should reject input exceeding 4096 characters', async () => {
      const res = await request(app)
        .post('/v1/audio/speech')
        .send({ model: 'tts-1', input: 'x'.repeat(4097), voice: 'alloy' });

      expect(res.status).toBe(400);
      expect(res.body.error.param).toBe('input');
    });
  });

  describe('provider with schema (EchoProvider)', () => {
    it('should reject missing voice when provider schema requires it', async () => {
      const res = await request(app)
        .post('/v1/audio/speech')
        .send({ model: 'tts-1', input: 'hello' });

      expect(res.status).toBe(400);
      expect(res.body.error.param).toBe('voice');
    });

    it('should reject empty voice', async () => {
      const res = await request(app)
        .post('/v1/audio/speech')
        .send({ model: 'tts-1', input: 'hello', voice: '' });

      expect(res.status).toBe(400);
      expect(res.body.error.param).toBe('voice');
    });

    it('should reject invalid response_format', async () => {
      const res = await request(app)
        .post('/v1/audio/speech')
        .send({ model: 'tts-1', input: 'hello', voice: 'alloy', response_format: 'midi' });

      expect(res.status).toBe(400);
      expect(res.body.error.param).toBe('response_format');
    });

    it('should reject speed below 0.25', async () => {
      const res = await request(app)
        .post('/v1/audio/speech')
        .send({ model: 'tts-1', input: 'hello', voice: 'alloy', speed: 0.1 });

      expect(res.status).toBe(400);
      expect(res.body.error.param).toBe('speed');
    });

    it('should reject speed above 4.0', async () => {
      const res = await request(app)
        .post('/v1/audio/speech')
        .send({ model: 'tts-1', input: 'hello', voice: 'alloy', speed: 5.0 });

      expect(res.status).toBe(400);
      expect(res.body.error.param).toBe('speed');
    });

    it('should reject non-numeric speed', async () => {
      const res = await request(app)
        .post('/v1/audio/speech')
        .send({ model: 'tts-1', input: 'hello', voice: 'alloy', speed: 'fast' });

      expect(res.status).toBe(400);
      expect(res.body.error.param).toBe('speed');
    });

    it('should return audio for valid request', async () => {
      const res = await request(app)
        .post('/v1/audio/speech')
        .send({ model: 'tts-1', input: 'hello world', voice: 'alloy' });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('audio/mpeg');
    });
  });

  describe('provider routing', () => {
    it('should return 400 for unsupported model', async () => {
      const res = await request(app)
        .post('/v1/audio/speech')
        .send({ model: 'unsupported-model', input: 'hello', voice: 'alloy' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('model_not_found');
    });
  });

  describe('parameter passthrough (with schema)', () => {
    function parse_body(res: request.Response): Record<string, unknown> {
      return JSON.parse((res.body as Buffer).toString('utf-8'));
    }

    it('should pass input and model directly, rest in extra', async () => {
      const res = await request(app)
        .post('/v1/audio/speech')
        .send({ model: 'tts-1', input: 'test input', voice: 'nova' });

      const body = parse_body(res);
      // Known fields
      expect(body.model).toBe('tts-1');
      expect(body.input).toBe('test input');
      // Provider-specific fields go to extra
      expect(body.extra).toHaveProperty('voice', 'nova');
    });

    it('should pass speed and response_format in extra', async () => {
      const res = await request(app)
        .post('/v1/audio/speech')
        .send({
          model: 'tts-1',
          input: 'hello',
          voice: 'alloy',
          speed: 1.5,
          response_format: 'wav',
        });

      const body = parse_body(res);
      expect(body.extra).toHaveProperty('speed', 1.5);
      expect(body.extra).toHaveProperty('response_format', 'wav');
    });

    it('should route to correct provider based on model', async () => {
      registry.register(new (class implements TtsProvider {
        readonly name = 'alt';
        get_models() { return ['tts-alt']; }
        supports_model(m: string) { return m === 'tts-alt'; }
        async speak(params: SpeechParams): Promise<SpeechResult> {
          return { content_type: 'audio/wav', data: Buffer.from(`alt-${params.model}:${params.input}`, 'utf-8') };
        }
      })());

      const res = await request(app)
        .post('/v1/audio/speech')
        .send({ model: 'tts-alt', input: 'world', voice: 'alloy' });

      expect(res.status).toBe(200);
      expect((res.body as Buffer).toString('utf-8')).toBe('alt-tts-alt:world');
    });
  });

  describe('provider without schema', () => {
    beforeEach(() => {
      registry.register(new MinimalProvider());
    });

    it('should accept request with only model and input', async () => {
      const res = await request(app)
        .post('/v1/audio/speech')
        .send({ model: 'minimal-model', input: 'hello' });

      expect(res.status).toBe(200);
      const body = JSON.parse((res.body as Buffer).toString('utf-8'));
      expect(body.model).toBe('minimal-model');
      expect(body.input).toBe('hello');
      // No extra fields passed through
      expect(body.extra).toEqual({});
    });

    it('should pass unknown fields to extra even without schema', async () => {
      const res = await request(app)
        .post('/v1/audio/speech')
        .send({ model: 'minimal-model', input: 'hello', some_custom_field: 'custom_value' });

      expect(res.status).toBe(200);
      const body = JSON.parse((res.body as Buffer).toString('utf-8'));
      expect(body.extra).toHaveProperty('some_custom_field', 'custom_value');
    });
  });
});
