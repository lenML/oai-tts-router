/**
 * Audio (TTS) routes.
 * Handles POST /v1/audio/speech.
 *
 * Validation flow:
 * 1. Parse `model` and `input` from the base schema (tts_request_base).
 * 2. Look up the provider that supports the requested model.
 * 3. If the provider defines a request_schema, validate the full body
 *    against it. The provider schema should extend tts_request_base
 *    to inherit model/input validation.
 * 4. Pass the validated data to the provider's speak() method.
 */

import { Router } from 'express';
import type { Response } from 'express';
import { tts_request_base } from '../types/schema.js';
import { openai_error_from_zod } from '../errors.js';
import type { ProviderRegistry } from '../providers/registry.js';
import { cache_key, cache_lookup, cache_store } from '../middleware/cache.js';
import { logger } from '../utils/logger.js';

const route_path = '/v1/audio/speech';

/** Register audio-related routes */
export function register_audio_routes(router: Router, registry: ProviderRegistry): void {
  router.post(route_path, async (req, res: Response) => {
    const body = (req.body ?? {}) as Record<string, unknown>;

    // Step 1: Validate base fields (model, input)
    const base_result = tts_request_base.safeParse(body);
    if (!base_result.success) {
      throw openai_error_from_zod(base_result.error);
    }

    // Step 2: Find the provider
    const provider = registry.find_provider(base_result.data.model);

    // Step 3: Validate against provider schema if available.
    // If no provider schema, accept the raw body (extras go to extra).
    let validated_body: Record<string, unknown>;
    if (provider.request_schema) {
      const schema_result = provider.request_schema.safeParse(body);
      if (!schema_result.success) {
        throw openai_error_from_zod(schema_result.error);
      }
      validated_body = schema_result.data;
    } else {
      // Without a provider schema, use the raw body so unknown fields
      // are preserved and end up in extra.
      validated_body = body;
    }

    // Step 4: Build SpeechParams and call the provider
    const { model, input, ...extra } = validated_body;
    // Check cache before calling the provider
    const ckey = cache_key(validated_body);
    const cached = cache_lookup(ckey);
    if (cached) {
      logger.info('tts cache hit', {
        model: model as string,
        input_length: (input as string).length,
        content_type: cached.content_type,
      });
      res.setHeader('Content-Type', cached.content_type);
      res.setHeader('X-Cache', 'HIT');
      res.send(cached.data);
      return;
    }

    logger.info('tts provider call', {
      model: model as string,
      provider: provider.name,
      input_length: (input as string).length,
    });
    const result = await provider.speak({
      model: model as string,
      input: input as string,
      extra,
    });
    logger.info('tts provider response', {
      model: model as string,
      provider: provider.name,
      content_type: result.content_type,
      response_bytes: result.data.length,
    });

    // Store in cache
    cache_store(ckey, result);

    // Set response headers and send audio data
    res.setHeader('Content-Type', result.content_type);
    res.setHeader('X-Cache', 'MISS');
    res.send(result.data);
  });
}
