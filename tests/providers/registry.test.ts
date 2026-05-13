import { describe, it, expect, beforeEach } from 'vitest';
import { ProviderRegistry } from '../../src/providers/registry.ts';
import { OpenAiError } from '../../src/errors.ts';
import type { TtsProvider, SpeechParams, SpeechResult } from '../../src/types/provider.ts';

class MockProvider implements TtsProvider {
  readonly name: string;
  private _models: string[];

  constructor(name: string, models: string[]) {
    this.name = name;
    this._models = models;
  }

  get_models(): string[] {
    return this._models;
  }

  supports_model(model: string): boolean {
    return this._models.includes(model);
  }

  async speak(_params: SpeechParams): Promise<SpeechResult> {
    return {
      content_type: 'audio/mpeg',
      data: Buffer.from('mock audio data'),
    };
  }
}

describe('ProviderRegistry', () => {
  let registry: ProviderRegistry;

  beforeEach(() => {
    registry = new ProviderRegistry();
  });

  it('should start empty', () => {
    expect(registry.get_provider_names()).toEqual([]);
    expect(registry.get_all_models()).toEqual([]);
  });

  it('should register and retrieve a provider by model', () => {
    const provider = new MockProvider('test-provider', ['tts-1', 'tts-1-hd']);
    registry.register(provider);

    const found = registry.find_provider('tts-1');
    expect(found.name).toBe('test-provider');
  });

  it('should retrieve provider names', () => {
    registry.register(new MockProvider('provider-a', ['model-a']));
    registry.register(new MockProvider('provider-b', ['model-b']));

    const names = registry.get_provider_names();
    expect(names).toContain('provider-a');
    expect(names).toContain('provider-b');
  });

  it('should collect all models from all providers', () => {
    registry.register(new MockProvider('p1', ['m1', 'm2']));
    registry.register(new MockProvider('p2', ['m3']));

    const models = registry.get_all_models();
    expect(models).toContain('m1');
    expect(models).toContain('m2');
    expect(models).toContain('m3');
  });

  it('should throw OpenAiError when model is not found', () => {
    registry.register(new MockProvider('p1', ['tts-1']));

    expect(() => registry.find_provider('nonexistent-model')).toThrow(OpenAiError);
    expect(() => registry.find_provider('nonexistent-model')).toThrow(
      "Model 'nonexistent-model' is not supported",
    );
  });

  it('should override provider with same name on re-register', () => {
    const p1 = new MockProvider('p1', ['model-a']);
    const p2 = new MockProvider('p1', ['model-b']);

    registry.register(p1);
    registry.register(p2);

    const found = registry.find_provider('model-b');
    expect(found.name).toBe('p1');
    expect(() => registry.find_provider('model-a')).toThrow(OpenAiError);
  });

  it('should be clearable', () => {
    registry.register(new MockProvider('p1', ['tts-1']));
    registry.clear();

    expect(registry.get_provider_names()).toEqual([]);
    expect(registry.get_all_models()).toEqual([]);
  });
});
