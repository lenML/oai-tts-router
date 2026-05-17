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
 *
 * Extended features (opt-in per request):
 * - text_split: Split long text into chunks, generate per chunk, concatenate audio.
 * - fallback_models: Try alternative models if the primary provider fails.
 */

import { Router } from 'express';
import type { Response } from 'express';
import { z } from 'zod';
import { load_config } from '../config.js';
import { tts_request_base, TEXT_SPLIT_MAX_INPUT } from '../types/schema.js';
import { openai_error_from_zod, OpenAiError } from '../errors.js';
import { OPENAI_ERROR_TYPE, OPENAI_ERROR_CODE } from '../types/openai.js';
import type { ProviderRegistry } from '../providers/registry.js';
import type { TtsProvider, SpeechParams, SpeechResult } from '../types/provider.js';
import { cache_key, cache_lookup, cache_store } from '../middleware/cache.js';
import { logger } from '../utils/logger.js';
import { split_text } from '../utils/text-split.js';
import { concat_audio } from '../utils/audio-concat.js';

const route_path = '/v1/audio/speech';

/** Default max length per chunk when text_split is enabled */
const DEFAULT_TEXT_SPLIT_MAX_LENGTH = 1000;

/** Extended input validation schema for text_split requests (relaxed max) */
const tts_request_text_split = tts_request_base.extend({
  input: z.string().min(1).max(TEXT_SPLIT_MAX_INPUT),
});

/** Register audio-related routes */
export function register_audio_routes(router: Router, registry: ProviderRegistry): void {
  router.post(route_path, async (req, res: Response) => {
    const body = (req.body ?? {}) as Record<string, unknown>;

    // Step 0: Apply default params from config for the requested model
    const model_hint = body['model'] as string | undefined;
    if (model_hint) {
      const defaults = load_config().default_params?.[model_hint];
      if (defaults) {
        for (const [key, value] of Object.entries(defaults)) {
          if (body[key] === undefined) {
            body[key] = value;
          }
        }
      }
    }

    // Extract extended params before base validation
    const text_split_enabled = body['text_split'] === true;
    const text_split_max_length =
      (body['text_split_max_length'] as number | undefined) ?? DEFAULT_TEXT_SPLIT_MAX_LENGTH;
    const fallback_models = body['fallback_models'] as string[] | undefined;

    // Step 1: Validate base fields (model, input)
    // Use relaxed input limit if text_split is enabled
    const base_schema = text_split_enabled ? tts_request_text_split : tts_request_base;
    const base_result = base_schema.safeParse(body);
    if (!base_result.success) {
      throw openai_error_from_zod(base_result.error);
    }

    // Step 2: Find the primary provider
    const primary_model = base_result.data.model;
    const provider = registry.find_provider(primary_model);

    // Step 3: Validate against provider schema if available.
    let validated_body: Record<string, unknown>;
    if (provider.request_schema) {
      const schema_result = provider.request_schema.safeParse(body);
      if (!schema_result.success) {
        throw openai_error_from_zod(schema_result.error);
      }
      validated_body = schema_result.data;
    } else {
      validated_body = body;
    }

    // Step 3.5: Extract feature flags before cache/provider processing
    const no_cache = validated_body['no_cache'] === true;

    // Build cache key BEFORE stripping feature flags so they are included
    const ckey_body = { ...validated_body };
    delete ckey_body['no_cache'];
    const ckey = cache_key(ckey_body);

    // Strip extended params from validated_body so they don't pollute `extra`
    delete validated_body['no_cache'];
    delete validated_body['text_split'];
    delete validated_body['text_split_max_length'];
    delete validated_body['fallback_models'];

    // Step 4: Build SpeechParams base
    const { model, input, ...extra } = validated_body;

    // Check cache before calling the provider
    const cached = no_cache ? undefined : cache_lookup(ckey);
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
      text_split: text_split_enabled,
      fallback_models: fallback_models?.length ?? 0,
    });

    // Step 5: Execute speak with optional text_split and fallback
    let result;
    try {
      result = await execute_speak_with_features(
        registry,
        provider,
        {
          model: model as string,
          input: input as string,
          extra,
        },
        {
          text_split_enabled,
          text_split_max_length,
          fallback_models,
          provider_name: provider.name,
        },
      );
    } catch (err) {
      // Re-throw provider errors as OpenAiError for proper status code
      const message = err instanceof Error ? err.message : String(err);
      throw new OpenAiError(
        message,
        OPENAI_ERROR_TYPE.PROVIDER,
        null,
        OPENAI_ERROR_CODE.PROVIDER_UNAVAILABLE,
        502,
      );
    }

    logger.info('tts provider response', {
      model: model as string,
      provider: provider.name,
      content_type: result.content_type,
      response_bytes: result.data.length,
    });

    // Store in cache
    if (!no_cache) {
      cache_store(ckey, result);
    }

    // Set response headers and send audio data
    res.setHeader('Content-Type', result.content_type);
    res.setHeader('X-Cache', 'MISS');
    res.send(result.data);
  });
}

// ── Feature execution ──────────────────────────────────────────────────────────

interface SpeakOptions {
  text_split_enabled: boolean;
  text_split_max_length: number;
  fallback_models?: string[];
  provider_name: string;
}

/**
 * Execute provider.speak() with optional text_split and fallback features.
 *
 * Order of operations:
 * 1. If text_split is enabled, split input -> speak each chunk -> concatenate.
 * 2. If the primary speak fails and fallback_models is set, try each fallback.
 * 3. If all fail, throw the last error.
 */
async function execute_speak_with_features(
  registry: ProviderRegistry,
  primary_provider: TtsProvider,
  params: SpeechParams,
  opts: SpeakOptions,
): Promise<SpeechResult> {
  const fallback_providers = collect_fallback_providers(
    registry,
    opts.fallback_models,
    params.model,
  );

  return await attempt_speak_with_fallback(primary_provider, fallback_providers, params, opts);
}

/**
 * Collect fallback providers from fallback_models list.
 * Returns providers in the order specified, skipping the primary model.
 */
function collect_fallback_providers(
  registry: ProviderRegistry,
  fallback_models: string[] | undefined,
  primary_model: string,
): Array<{ model: string; provider: TtsProvider }> {
  if (!fallback_models || fallback_models.length === 0) {
    return [];
  }

  const seen_models = new Set<string>([primary_model]);
  const result: Array<{ model: string; provider: TtsProvider }> = [];

  for (const fb_model of fallback_models) {
    if (seen_models.has(fb_model)) continue;
    seen_models.add(fb_model);

    try {
      const provider = registry.find_provider(fb_model);
      result.push({ model: fb_model, provider });
    } catch {
      logger.warn('fallback model not found', { model: fb_model });
    }
  }

  return result;
}

/**
 * Try speak on the primary provider, then each fallback.
 * For text_split, each chunk is generated on each provider attempt.
 */
async function attempt_speak_with_fallback(
  primary: TtsProvider,
  fallbacks: Array<{ model: string; provider: TtsProvider }>,
  params: SpeechParams,
  opts: SpeakOptions,
): Promise<SpeechResult> {
  // eslint-disable-next-line no-useless-assignment
  let last_error: Error | null = null;

  // Try primary
  try {
    return await do_speak(primary, params, opts);
  } catch (err) {
    last_error = err instanceof Error ? err : new Error(String(err));
    logger.warn('primary provider failed, attempting fallback', {
      provider: opts.provider_name,
      model: params.model,
      error: last_error.message,
      fallback_count: fallbacks.length,
    });
  }

  // Try each fallback
  for (const fb of fallbacks) {
    try {
      logger.info('fallback attempt', {
        provider: fb.provider.name,
        model: fb.model,
      });

      const fb_params: SpeechParams = {
        ...params,
        model: fb.model,
      };

      return await do_speak(fb.provider, fb_params, opts);
    } catch (err) {
      last_error = err instanceof Error ? err : new Error(String(err));
      logger.warn('fallback provider failed', {
        provider: fb.provider.name,
        model: fb.model,
        error: last_error.message,
      });
    }
  }

  throw (
    last_error ??
    new OpenAiError(
      'All providers failed',
      OPENAI_ERROR_TYPE.PROVIDER,
      null,
      OPENAI_ERROR_CODE.PROVIDER_UNAVAILABLE,
      502,
    )
  );
}

/**
 * Execute speak on a single provider, with optional text splitting.
 */
async function do_speak(
  provider: TtsProvider,
  params: SpeechParams,
  opts: SpeakOptions,
): Promise<SpeechResult> {
  if (opts.text_split_enabled && params.input.length > opts.text_split_max_length) {
    return await speak_with_split(provider, params, opts.text_split_max_length);
  }
  return await provider.speak(params);
}

/**
 * Split text into chunks, generate audio for each, then concatenate.
 */
async function speak_with_split(
  provider: TtsProvider,
  params: SpeechParams,
  max_length: number,
): Promise<SpeechResult> {
  const chunks = split_text(params.input, max_length);

  logger.info('text_split chunks', {
    provider: provider.name,
    model: params.model,
    total_length: params.input.length,
    chunk_count: chunks.length,
    max_chunk_length: max_length,
  });

  const results: SpeechResult[] = [];

  for (let i = 0; i < chunks.length; i++) {
    logger.info('text_split chunk generation', {
      provider: provider.name,
      model: params.model,
      chunk: i + 1,
      of: chunks.length,
      chunk_length: chunks[i].length,
    });

    const chunk_params: SpeechParams = { ...params, input: chunks[i] };
    const result = await provider.speak(chunk_params);
    results.push(result);
  }

  return concat_audio(results);
}
