/**
 * TTS Provider registry.
 * Manages all registered providers and looks up the right provider by model.
 */

import type { TtsProvider } from '../types/provider.js';
import { OpenAiError } from '../errors.js';
import { OPENAI_ERROR_TYPE, OPENAI_ERROR_CODE } from '../types/openai.js';

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
   * Clear all registered providers.
   */
  clear(): void {
    this.providers.clear();
  }
}
