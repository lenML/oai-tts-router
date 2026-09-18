/**
 * ElevenLabs route integration tests.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import express, { Router } from 'express';
import type { Express } from 'express';
import request from 'supertest';
import { register_audio_routes } from '../../src/routes/audio.js';
import { ProviderRegistry } from '../../src/providers/registry.js';
import { ElevenlabsProvider } from '../../src/providers/elevenlabs.js';
import { init_cache } from '../../src/middleware/cache.js';

const mock_fetch = vi.hoisted(() => vi.fn());

vi.mock('node-fetch', () => ({
  default: mock_fetch,
}));

function mock_audio() {
  mock_fetch.mockResolvedValue({
    ok: true,
    status: 200,
    headers: {
      get: (name: string) => (name.toLowerCase() === 'content-type' ? 'audio/mpeg' : null),
    },
    arrayBuffer: () => Promise.resolve(Buffer.from('audio')),
  });
}

let app: Express;

describe('POST /v1/audio/speech - elevenlabs', () => {
  beforeEach(() => {
    init_cache('1mb');
    mock_fetch.mockReset();

    const registry = new ProviderRegistry();
    registry.register(new ElevenlabsProvider({ keys: ['config-key'] }));
    app = express();
    const router = Router();
    app.use(express.json());
    register_audio_routes(router, registry);
    app.use(router);
  });

  it('should accept request keys and isolate cache entries by key hash', async () => {
    mock_audio();

    const first = await request(app)
      .post('/v1/audio/speech')
      .send({
        model: 'elevenlabs',
        input: 'cache-key-test',
        voice_id: 'voice',
        keys: ['request-key-a'],
      });
    const second = await request(app)
      .post('/v1/audio/speech')
      .send({
        model: 'elevenlabs',
        input: 'cache-key-test',
        voice_id: 'voice',
        keys: ['request-key-b'],
      });
    const repeat = await request(app)
      .post('/v1/audio/speech')
      .send({
        model: 'elevenlabs',
        input: 'cache-key-test',
        voice_id: 'voice',
        keys: ['request-key-a'],
      });

    expect([first.status, second.status, repeat.status]).toEqual([200, 200, 200]);
    expect([
      first.headers['x-cache'],
      second.headers['x-cache'],
      repeat.headers['x-cache'],
    ]).toEqual(['MISS', 'MISS', 'HIT']);
    expect(mock_fetch).toHaveBeenCalledTimes(2);
    expect(mock_fetch.mock.calls[0][1].headers['xi-api-key']).toBe('request-key-a');
    expect(mock_fetch.mock.calls[1][1].headers['xi-api-key']).toBe('request-key-b');
  });
});
