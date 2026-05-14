/**
 * Cache middleware tests.
 * Tests init_cache, cache_key, cache_lookup, cache_store.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { init_cache, cache_key, cache_lookup, cache_store } from '../../src/middleware/cache.js';
import type { SpeechResult } from '../../src/types/provider.js';

describe('cache_key', () => {
  it('should produce deterministic keys for the same body', () => {
    const body_a = { model: 'tts-1', input: 'hello', voice: 'alloy' };
    const body_b = { input: 'hello', voice: 'alloy', model: 'tts-1' };

    expect(cache_key(body_a)).toBe(cache_key(body_b));
  });

  it('should produce different keys for different bodies', () => {
    const body_a = { model: 'tts-1', input: 'hello' };
    const body_b = { model: 'tts-1', input: 'world' };

    expect(cache_key(body_a)).not.toBe(cache_key(body_b));
  });
});

describe('cache lifecycle', () => {
  beforeEach(() => {
    init_cache('1mb');
  });

  it('should store and retrieve a cached entry', () => {
    const result: SpeechResult = {
      content_type: 'audio/mpeg',
      data: Buffer.from('fake-audio-data'),
    };

    const key = cache_key({ model: 'tts-1', input: 'hello' });
    cache_store(key, result);

    const cached = cache_lookup(key);
    expect(cached).toBeDefined();
    expect(cached!.content_type).toBe('audio/mpeg');
    expect(cached!.data.toString()).toBe('fake-audio-data');
  });

  it('should return undefined for a cache miss', () => {
    const result: SpeechResult = {
      content_type: 'audio/wav',
      data: Buffer.from('data'),
    };
    cache_store(cache_key({ model: 'tts-1', input: 'a' }), result);

    const miss = cache_lookup(cache_key({ model: 'tts-1', input: 'b' }));
    expect(miss).toBeUndefined();
  });

  it('should evict least recently used entry when over max size', () => {
    // Fill cache with two entries that together exceed 1mb
    const big = Buffer.alloc(700_000, 'x'); // ~700kb
    const bigger = Buffer.alloc(700_000, 'y'); // ~700kb

    const key_a = cache_key({ model: 'tts-1', input: 'a' });
    const key_b = cache_key({ model: 'tts-1', input: 'b' });

    cache_store(key_a, { content_type: 'audio/mpeg', data: big });
    cache_store(key_b, { content_type: 'audio/mpeg', data: bigger });

    // First entry should be evicted (maxSize=1mb, each ~700kb > 1mb/2)
    // Actually both fit if retention within maxSize allows total > maxSize
    // The first set entry (key_a) should be evicted when key_b is added
    // because total (1.4mb) > maxSize (1mb) and LRU evicts oldest.
    expect(cache_lookup(key_a)).toBeUndefined();
    expect(cache_lookup(key_b)).toBeDefined();
  });

  it('should return undefined when cache is disabled (size=0)', () => {
    init_cache('0');

    const key = cache_key({ model: 'tts-1', input: 'hello' });
    cache_store(key, { content_type: 'audio/mpeg', data: Buffer.from('x') });

    expect(cache_lookup(key)).toBeUndefined();
  });

  it('should return undefined when cache is disabled (unset)', () => {
    init_cache(undefined);

    const key = cache_key({ model: 'tts-1', input: 'hello' });
    cache_store(key, { content_type: 'audio/mpeg', data: Buffer.from('x') });

    expect(cache_lookup(key)).toBeUndefined();
  });
});

describe('init_cache size parsing', () => {
  it('should accept "10mb" as valid size', () => {
    init_cache('10mb');

    const key = cache_key({ model: 'tts-1', input: 'test' });
    const small = Buffer.alloc(100);
    cache_store(key, { content_type: 'audio/mpeg', data: small });

    expect(cache_lookup(key)).toBeDefined();
  });

  it('should accept "1gb" as valid size', () => {
    init_cache('1gb');

    const key = cache_key({ model: 'tts-1', input: 'test' });
    cache_store(key, { content_type: 'audio/mpeg', data: Buffer.from('x') });

    expect(cache_lookup(key)).toBeDefined();
  });

  it('should accept "1kb" as valid size', () => {
    init_cache('1kb');

    const key = cache_key({ model: 'tts-1', input: 'test' });
    cache_store(key, { content_type: 'audio/mpeg', data: Buffer.from('x') });

    expect(cache_lookup(key)).toBeDefined();
  });

  it('should treat garbage input as disabled', () => {
    init_cache('garbage');

    const key = cache_key({ model: 'tts-1', input: 'test' });
    cache_store(key, { content_type: 'audio/mpeg', data: Buffer.from('x') });

    expect(cache_lookup(key)).toBeUndefined();
  });
});
