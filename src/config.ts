/**
 * Application configuration loader.
 *
 * Priority (highest to lowest):
 *   1. Environment variables (.env / process.env)
 *   2. config.json values
 *   3. Built-in defaults
 *
 * Sensitive overrides (API keys, proxy) should go in .env;
 * structural config (providers, defaults) belongs in config.json.
 */

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Types ───────────────────────────────────────────────────

export interface AppConfig {
  port: number;
  log_level: string;
  api_keys: string[];
  proxy: {
    http?: string;
    https?: string;
  };
  cache: {
    tts_size?: string;
  };
  /** Provider-specific options, keyed by provider name */
  providers: Record<string, Record<string, unknown>>;
  /**
   * Default request parameters per model.
   * Applied when the incoming request body omits a field.
   */
  default_params: Record<string, Record<string, unknown>>;
}

// ── Defaults ─────────────────────────────────────────────────

const DEFAULTS: AppConfig = {
  port: 3000,
  log_level: 'info',
  api_keys: [],
  proxy: {},
  cache: {},
  providers: {},
  default_params: {},
};

// ── Path resolution ──────────────────────────────────────────

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function resolve_config_path(): string {
  const env_path = process.env['CONFIG_PATH'];
  if (env_path) return path.resolve(env_path);
  return path.join(PROJECT_ROOT, 'config.json');
}

// ── File loading ─────────────────────────────────────────────

function load_file(): Partial<AppConfig> {
  const file_path = resolve_config_path();
  if (!existsSync(file_path)) return {};
  try {
    const content = readFileSync(file_path, 'utf-8');
    return JSON.parse(content) as Partial<AppConfig>;
  } catch (err) {
    console.error(`failed to load config from "${file_path}":`, err);
    throw err;
  }
}

// ── Merge: env overrides config.json overrides defaults ───────

function merge_env(file_cfg: Partial<AppConfig>): AppConfig {
  const cfg: AppConfig = {
    ...DEFAULTS,
    ...file_cfg,
    proxy: { ...DEFAULTS.proxy, ...file_cfg.proxy },
    cache: { ...DEFAULTS.cache, ...file_cfg.cache },
    providers: { ...DEFAULTS.providers, ...file_cfg.providers },
    default_params: { ...DEFAULTS.default_params, ...file_cfg.default_params },
  };

  // Environment variables take highest priority
  if (process.env['PORT']) cfg.port = parseInt(process.env['PORT'], 10);
  if (process.env['LOG_LEVEL']) cfg.log_level = process.env['LOG_LEVEL'];
  if (process.env['API_KEY']) {
    cfg.api_keys = process.env['API_KEY']
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }
  if (process.env['TTS_CACHE_SIZE']) cfg.cache.tts_size = process.env['TTS_CACHE_SIZE'];
  if (process.env['HTTP_PROXY']) cfg.proxy.http = process.env['HTTP_PROXY'];
  if (process.env['HTTPS_PROXY']) cfg.proxy.https = process.env['HTTPS_PROXY'];

  return cfg;
}

// ── Singleton ────────────────────────────────────────────────

let _config: AppConfig | null = null;

/** Load (or return cached) application configuration. */
export function load_config(): AppConfig {
  if (!_config) {
    _config = merge_env(load_file());
  }
  return _config;
}
