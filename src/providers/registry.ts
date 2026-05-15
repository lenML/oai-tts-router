/**
 * TTS Provider registry.
 * Manages all registered providers and looks up the right provider by model.
 */

import type { TtsProvider } from '../types/provider.js';
import type { ModelInfo } from '../types/models.js';
import { OpenAiError } from '../errors.js';
import { OPENAI_ERROR_TYPE, OPENAI_ERROR_CODE } from '../types/openai.js';

/** Base timestamp used for all model `created` fields */
const BASE_TIME = 1_715_000_000;

export class ProviderRegistry {
  private providers = new Map<string, TtsProvider>();

  /**
   * Register a TTS Provider.
   * If a provider with the same name already exists, it is overwritten.
   */
  register(provider: TtsProvider): void {
    this.providers.set(provider.name, provider);
  }

  /**
   * Get all registered provider names.
   */
  get_provider_names(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Find the provider that supports the given model ID.
   * @param model - Model ID
   * @returns The matching TtsProvider
   * @throws OpenAiError if no provider supports the model
   */
  find_provider(model: string): TtsProvider {
    for (const provider of this.providers.values()) {
      if (provider.supports_model(model)) {
        return provider;
      }
    }

    throw new OpenAiError(
      `Model '${model}' is not supported by any registered provider.`,
      OPENAI_ERROR_TYPE.INVALID_REQUEST,
      'model',
      OPENAI_ERROR_CODE.MODEL_NOT_FOUND,
      400,
    );
  }

  /**
   * Get all model IDs across all registered providers.
   */
  get_all_models(): string[] {
    const models: string[] = [];
    for (const provider of this.providers.values()) {
      models.push(...provider.get_models());
    }
    return models;
  }

  /**
   * Get detailed info for all models across all providers.
   */
  get_all_models_info(): ModelInfo[] {
    const result: ModelInfo[] = [];
    for (const provider of this.providers.values()) {
      const models = provider.get_models();
      for (const model_id of models) {
        const voices = provider.get_model_voices?.(model_id) ?? [];
        result.push({
          id: model_id,
          object: 'model',
          created: BASE_TIME,
          owned_by: provider.owned_by ?? provider.name,
          supported_voices: voices,
        });
      }
    }
    return result;
  }

  /**
   * Get detailed info for a single model.
   * @param model_id - Model ID to look up
   * @returns ModelInfo or undefined if not found
   */
  get_model_info(model_id: string): ModelInfo | undefined {
    for (const provider of this.providers.values()) {
      if (provider.supports_model(model_id)) {
        const voices = provider.get_model_voices?.(model_id) ?? [];
        return {
          id: model_id,
          object: 'model',
          created: BASE_TIME,
          owned_by: provider.owned_by ?? provider.name,
          supported_voices: voices,
        };
      }
    }
    return undefined;
  }

  /**
   * Clear all registered providers.
   */
  clear(): void {
    this.providers.clear();
  }
}
