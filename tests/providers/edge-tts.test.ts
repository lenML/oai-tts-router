/**
 * Edge TTS provider tests.
 * Uses vi.mock to avoid actual Edge TTS network calls.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EdgeTtsProvider } from '../../src/providers/edge-tts.js';

// Mock the edge-tts module with a proper constructor
vi.mock('@andresaya/edge-tts', () => {
  const mockVoices = [
    { ShortName: 'en-US-JennyNeural' },
    { ShortName: 'en-US-GuyNeural' },
    { ShortName: 'zh-CN-XiaoxiaoNeural' },
  ];

  const mockSynthesize = vi.fn();
  const mockGetVoices = vi.fn().mockResolvedValue(mockVoices);

  function MockEdgeTTS() {
    return {
      getVoices: mockGetVoices,
      synthesize: mockSynthesize,
      toBuffer: function () {
        return Buffer.from('mock-mp3-data');
      },
    };
  }

  return {
    EdgeTTS: MockEdgeTTS,
    Constants: {
      OUTPUT_FORMAT: {
        AUDIO_24KHZ_48KBITRATE_MONO_MP3: 'audio-24khz-48kbitrate-mono-mp3',
        AUDIO_24KHZ_96KBITRATE_MONO_MP3: 'audio-24khz-96kbitrate-mono-mp3',
        WEBM_24KHZ_16BIT_MONO_OPUS: 'webm-24khz-16bit-mono-opus',
      },
    },
  };
});

describe('EdgeTtsProvider', () => {
  let provider: EdgeTtsProvider;

  beforeEach(() => {
    provider = new EdgeTtsProvider();
  });

  describe('basic info', () => {
    it('should have correct name', () => {
      expect(provider.name).toBe('edge-tts');
    });

    it('should have owned_by set to microsoft', () => {
      expect(provider.owned_by).toBe('microsoft');
    });

    it('should return models list', () => {
      expect(provider.get_models()).toEqual(['edge-tts']);
    });

    it('should support edge-tts model', () => {
      expect(provider.supports_model('edge-tts')).toBe(true);
    });

    it('should not support unknown models', () => {
      expect(provider.supports_model('tts-1')).toBe(false);
    });
  });

  describe('voices', () => {
    it('should return cached voices after speak', async () => {
      // Trigger cache population by calling speak
      await provider.speak({
        model: 'edge-tts',
        input: 'test',
        extra: { voice: 'en-US-JennyNeural' },
      });

      const voices = provider.get_model_voices('edge-tts');
      expect(voices).toContain('en-US-JennyNeural');
      expect(voices).toContain('en-US-GuyNeural');
      expect(voices).toContain('zh-CN-XiaoxiaoNeural');
    });
  });

  describe('speak', () => {
    beforeEach(async () => {
      // Ensure voice cache is populated
      await provider.speak({
        model: 'edge-tts',
        input: 'init',
        extra: { voice: 'en-US-JennyNeural' },
      });
    });

    it('should synthesize with voice and return mp3', async () => {
      const result = await provider.speak({
        model: 'edge-tts',
        input: 'Hello world',
        extra: { voice: 'en-US-JennyNeural' },
      });

      expect(result.content_type).toBe('audio/mpeg');
      expect(result.data).toBeInstanceOf(Buffer);
      expect(result.data.toString()).toBe('mock-mp3-data');
    });

    it('should pass rate/volume/pitch options', async () => {
      const { EdgeTTS } = await import('@andresaya/edge-tts');

      const instance = new (EdgeTTS as never)();
      const synthesizeSpy = vi.spyOn(instance, 'synthesize');

      await provider.speak({
        model: 'edge-tts',
        input: 'test',
        extra: {
          voice: 'en-US-JennyNeural',
          rate: '+50%',
          volume: '-20%',
          pitch: '+30Hz',
        },
      });
    });

    it('should reject request without voice', async () => {
      await expect(
        provider.speak({
          model: 'edge-tts',
          input: 'test',
          extra: {},
        }),
      ).rejects.toThrow('voice');
    });
  });
});
