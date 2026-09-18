import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { create_app } from '../src/server.js';
import { ProviderRegistry } from '../src/providers/registry.js';

const ALLOWED_ORIGIN = 'https://lenml.github.io';

describe('HTTP error boundaries', () => {
  it('should return OpenAI JSON for malformed JSON', async () => {
    const app = create_app(new ProviderRegistry());
    const res = await request(app)
      .post('/v1/audio/speech')
      .set('Content-Type', 'application/json')
      .send('{"model":');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({
      type: 'invalid_request_error',
      code: 'invalid_json',
    });
  });

  it('should return 413 for request bodies over 100kb', async () => {
    const app = create_app(new ProviderRegistry());
    const res = await request(app)
      .post('/v1/audio/speech')
      .send({ model: 'tts-1', input: 'x'.repeat(110 * 1024), voice: 'alloy' });

    expect(res.status).toBe(413);
    expect(res.body.error).toMatchObject({
      type: 'invalid_request_error',
      code: 'request_too_large',
    });
  });

  it('should return JSON 404 for unknown API endpoints', async () => {
    const app = create_app(new ProviderRegistry());
    const res = await request(app).get('/v1/unknown');

    expect(res.status).toBe(404);
    expect(res.body.error).toMatchObject({
      type: 'invalid_request_error',
      code: 'not_found',
    });
  });

  it('should return JSON 405 for unsupported methods', async () => {
    const app = create_app(new ProviderRegistry());
    const res = await request(app).get('/v1/audio/speech');

    expect(res.status).toBe(405);
    expect(res.headers.allow).toBe('POST');
    expect(res.body.error).toMatchObject({
      type: 'invalid_request_error',
      code: 'method_not_allowed',
    });
  });
});

describe('CORS', () => {
  it('should allow all origins by default', async () => {
    const app = create_app(new ProviderRegistry());
    const res = await request(app).get('/health').set('Origin', ALLOWED_ORIGIN);

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('*');
  });

  it('should allow origins in the configured list', async () => {
    const app = create_app(new ProviderRegistry(), { origin: [ALLOWED_ORIGIN] });
    const res = await request(app).get('/health').set('Origin', ALLOWED_ORIGIN);

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
  });

  it('should reject origins outside the configured list', async () => {
    const app = create_app(new ProviderRegistry(), { origin: [ALLOWED_ORIGIN] });
    const res = await request(app).get('/health').set('Origin', 'https://example.com');

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('should allow authorization headers in preflight requests', async () => {
    const app = create_app(new ProviderRegistry(), { origin: [ALLOWED_ORIGIN] });
    const res = await request(app)
      .options('/v1/audio/speech')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'authorization,content-type');

    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
    expect(res.headers['access-control-allow-headers']).toContain('authorization');
  });
});
