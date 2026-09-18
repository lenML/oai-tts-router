import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { create_app } from '../src/server.js';
import { ProviderRegistry } from '../src/providers/registry.js';

const ALLOWED_ORIGIN = 'https://lenml.github.io';

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
