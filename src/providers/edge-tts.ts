/**
 * Edge TTS provider.
 * Uses @andresaya/edge-tts to synthesize speech via Microsoft Edge TTS service.
 *
 * Supports all 322+ Edge TTS voices. Voice is selected via the `voice` parameter
 * using the voice ShortName (e.g. "en-US-JennyNeural").
 *
 * Supported extra params:
 *   - `voice` (required): Edge TTS voice ShortName
 *   - `rate`: speech rate, e.g. "+50%", "-30%" (default "+0%")
 *   - `volume`: speech volume, e.g. "+20%", "-50%" (default "+0%")
 *   - `pitch`: voice pitch, e.g. "+20Hz", "-10Hz" (default "+0Hz")
 *   - `output_format`: raw Edge TTS output format string (overrides response_format mapping)
 */

import { z } from 'zod';
import { EdgeTTS, Constants } from '@andresaya/edge-tts';
import { tts_request_base } from '../types/schema.js';
import type { TtsProvider, SpeechParams, SpeechResult } from '../types/provider.js';

// ── Schema ───────────────────────────────────────────────────

const edge_tts_schema = tts_request_base.extend({
  voice: z.string().min(1, { message: 'The `voice` parameter is required for Edge TTS.' }),
  rate: z.string().optional(),
  volume: z.string().optional(),
  pitch: z.string().optional(),
  output_format: z.string().optional(),
});

// ── Format mapping ────────────────────────────────────────────

/** OpenAI response_format to Edge TTS output format */
const FORMAT_TO_EDGE: Record<string, string> = {
  mp3: Constants.OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3,
  opus: Constants.OUTPUT_FORMAT.WEBM_24KHZ_16BIT_MONO_OPUS,
  aac: Constants.OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3,
  flac: Constants.OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3,
  wav: Constants.OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3,
  pcm: Constants.OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3,
};

/** Content-Type when format doesn't match the actual audio (Edge always returns mp3/opus) */
const EDGE_CONTENT_TYPE = 'audio/mpeg';

// ── Voice cache (preloaded at module init) ────────────────────

let voices_cache: string[] = [];

/** Preload voice list so get_model_voices() returns data synchronously */
const voice_preload: Promise<void> = (async () => {
  try {
    const tts = new EdgeTTS();
    const voices = await tts.getVoices();
    voices_cache = voices.map(v => v.ShortName).sort();
  } catch {
    voices_cache = [];
  }
})();

// ── Provider ──────────────────────────────────────────────────

export class EdgeTtsProvider implements TtsProvider {
  readonly name = 'edge-tts';
  readonly owned_by = 'microsoft';
  request_schema = edge_tts_schema;

  get_models(): string[] {
    return ['edge-tts'];
  }

  get_model_voices(_model: string): string[] {
    return voices_cache;
  }

  supports_model(model: string): boolean {
    return model === 'edge-tts';
  }

  async speak(params: SpeechParams): Promise<SpeechResult> {
    const text = params.input;
    const voice = params.extra['voice'] as string | undefined;
    if (!voice) {
      throw new Error('The `voice` parameter is required for Edge TTS.');
    }

    // Resolve output format
    const response_format = (params.extra['response_format'] as string | undefined) ?? 'mp3';
    // Allow direct output_format override via extra
    const edge_output_format =
      (params.extra['output_format'] as string | undefined) ??
      FORMAT_TO_EDGE[response_format] ??
      Constants.OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3;

    // Build options
    const options: Record<string, unknown> = {};
    options['outputFormat'] = edge_output_format;

    const rate = params.extra['rate'] as string | undefined;
    const volume = params.extra['volume'] as string | undefined;
    const pitch = params.extra['pitch'] as string | undefined;

    if (rate !== undefined) options.rate = rate;
    if (volume !== undefined) options.volume = volume;
    if (pitch !== undefined) options.pitch = pitch;

    // Wait for voice cache to populate before proceeding (safety net)
    voice_preload.catch(() => {});

    const tts = new EdgeTTS();
    await tts.synthesize(text, voice, options);
    const buffer = tts.toBuffer();

    // Determine content-type
    const is_opus = edge_output_format === Constants.OUTPUT_FORMAT.WEBM_24KHZ_16BIT_MONO_OPUS;
    const content_type = is_opus ? 'audio/ogg' : EDGE_CONTENT_TYPE;

    return { content_type, data: buffer };
  }
}
