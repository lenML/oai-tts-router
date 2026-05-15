/**
 * LRU response cache for TTS requests.
 *
 * If the same request body is received within the cache lifetime,
 * the cached audio buffer is returned directly without hitting the provider.
 *
 * Env: TTS_CACHE_SIZE — e.g. "10mb", "100mb", "0" to disable (default: 0).
 */

import { LRUCache } from 'lru-cache';
import type { SpeechResult } from '../types/provider.js';
import { logger } from '../utils/logger.js';

// ── Types ───────────────────────────────────────────────────

interface CacheEntry {
  content_type: string;
  data: Buffer;
}

// ── State ───────────────────────────────────────────────────

let cache: LRUCache<string, CacheEntry> | null = null;

// ── Initialization ──────────────────────────────────────────

/** Initialize (or disable) the TTS response cache. */
export function init_cache(size_spec: string | undefined): void {
  const max_size = parse_bytes(size_spec);
  if (max_size <= 0) {
    logger.info('cache disabled');
    cache = null;
    return;
  }

  logger.info('cache enabled', { max_size: size_spec });

  // lru-cache options use camelCase — disable naming convention for these props
  cache = new LRUCache<string, CacheEntry>({
    // eslint-disable-next-line @typescript-eslint/naming-convention
    maxSize: max_size,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    sizeCalculation: entry => entry.data.length,
  });
}

// ── Public API ──────────────────────────────────────────────

/** Compute a deterministic cache key from the request body. */
export function cache_key(body: Record<string, unknown>): string {
  return JSON.stringify(body, Object.keys(body).sort());
}

/** Look up a cached response. Returns undefined on miss. */
export function cache_lookup(key: string): SpeechResult | undefined {
  const entry = cache?.get(key);
  if (!entry) return undefined;
  return { content_type: entry.content_type, data: entry.data };
}

/** Store a response in the cache. */
export function cache_store(key: string, result: SpeechResult): void {
  cache?.set(key, {
    content_type: result.content_type,
    data: result.data,
  });
}

// ── Helpers ─────────────────────────────────────────────────

function parse_bytes(spec: string | undefined): number {
  if (!spec || spec.trim() === '') return 0;
  const s = spec.trim().toLowerCase();
  const m = s.match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/);
  if (!m) return 0;

  const num = parseFloat(m[1]);
  const unit = m[2] || 'b';

  switch (unit) {
    case 'gb':
      return num * 1024 * 1024 * 1024;
    case 'mb':
      return num * 1024 * 1024;
    case 'kb':
      return num * 1024;
    default:
      return num;
  }
}
