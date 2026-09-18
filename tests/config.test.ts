import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const MANAGED_ENV = [
  'CONFIG_PATH',
  'XAI_CONSOLE_COOKIE',
  'GEMINI_TOKEN',
  'ELEVENLABS_API_KEY',
  'FLARESOLVERR_URL',
  'FLARESOLVERR_PROXY',
  'GROK_BROWSER_VERSION',
] as const;
const original_env = Object.fromEntries(MANAGED_ENV.map(key => [key, process.env[key]]));

afterEach(() => {
  vi.resetModules();
  for (const key of MANAGED_ENV) {
    const value = original_env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('config environment overrides', () => {
  it('should inject config.json proxy into provider config', async () => {
    vi.resetModules();
    const { with_outbound_proxy } = await import('../src/config.js');

    expect(
      with_outbound_proxy({ tokens: ['token'] }, { https: 'http://proxy.example.com:8080' }),
    ).toEqual({
      tokens: ['token'],
      proxy: 'http://proxy.example.com:8080',
    });
    expect(
      with_outbound_proxy(
        { proxy: 'socks5://provider-proxy:1080' },
        { https: 'http://proxy.example.com:8080' },
      ),
    ).toEqual({ proxy: 'socks5://provider-proxy:1080' });
  });

  it('should map provider credentials from environment variables', async () => {
    process.env['CONFIG_PATH'] = path.join(process.cwd(), '__missing_config__.json');
    process.env['XAI_CONSOLE_COOKIE'] = 'test-cookie';
    process.env['GEMINI_TOKEN'] = 'test-token';
    process.env['ELEVENLABS_API_KEY'] = 'eleven-key-a,eleven-key-b';

    vi.resetModules();
    const { load_config } = await import('../src/config.js');
    const config = load_config();

    expect(config.providers['grok-console-tts']?.cookies).toEqual(['test-cookie']);
    expect(config.providers['gemini-tts']?.tokens).toEqual(['test-token']);
    expect(config.providers['elevenlabs']?.keys).toEqual(['eleven-key-a', 'eleven-key-b']);
  });
});
