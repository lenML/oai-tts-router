/**
 * Models route tests.
 * Tests GET /v1/models and GET /v1/models/:model.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import express, { Router } from 'express';
import type { Express } from 'express';
import request from 'supertest';
import { register_models_routes } from '../../src/routes/models.js';
import { ProviderRegistry } from '../../src/providers/registry.js';
import { error_handler } from '../../src/errors.js';
import type { TtsProvider, SpeechParams, SpeechResult } from '../../src/types/provider.js';

class TestProvider implements TtsProvider {
  readonly name = 'test';
  readonly owned_by = 'test-org';

  get_models(): string[] {
    return ['model-a', 'model-b'];
  }

  supports_model(model: string): boolean {
    return model === 'model-a' || model === 'model-b';
  }

  get_model_voices(model: string): string[] {
    if (model === 'model-a') return ['alpha', 'beta'];
    return [];
  }

  async speak(_params: SpeechParams): Promise<SpeechResult> {
    return { content_type: 'audio/mpeg', data: Buffer.from('') };
  }
}

function build_app(registry: ProviderRegistry): Express {
  const app = express();
  const router = Router();
  register_models_routes(router, registry);
  app.use(router);
  app.use(error_handler);
  return app;
}

describe('GET /v1/models', () => {
  let registry: ProviderRegistry;
  let app: Express;

  beforeEach(() => {
    registry = new ProviderRegistry();
    registry.register(new TestProvider());
    app = build_app(registry);
  });

  it('should list all models', async () => {
    const res = await request(app).get('/v1/models');

    expect(res.status).toBe(200);
    expect(res.body.object).toBe('list');
    expect(res.body.data).toHaveLength(2);
  });

  it('should include model metadata', async () => {
    const res = await request(app).get('/v1/models');

    const model_a = res.body.data.find((m: { id: string }) => m.id === 'model-a');
    expect(model_a).toBeDefined();
    expect(model_a.object).toBe('model');
    expect(model_a.owned_by).toBe('test-org');
    expect(model_a.supported_voices).toEqual(['alpha', 'beta']);
  });

  it('should include model with empty voices', async () => {
    const res = await request(app).get('/v1/models');

    const model_b = res.body.data.find((m: { id: string }) => m.id === 'model-b');
    expect(model_b).toBeDefined();
    expect(model_b.supported_voices).toEqual([]);
  });
});

describe('GET /v1/models/:model', () => {
  let registry: ProviderRegistry;
  let app: Express;

  beforeEach(() => {
    registry = new ProviderRegistry();
    registry.register(new TestProvider());
    app = build_app(registry);
  });

  it('should return model info by ID', async () => {
    const res = await request(app).get('/v1/models/model-a');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('model-a');
    expect(res.body.object).toBe('model');
    expect(res.body.owned_by).toBe('test-org');
    expect(res.body.supported_voices).toEqual(['alpha', 'beta']);
  });

  it('should return 404 for unknown model', async () => {
    const res = await request(app).get('/v1/models/unknown');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('model_not_found');
  });
});
