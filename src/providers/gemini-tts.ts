/**
 * Gemini TTS provider.
 * Uses cuimp to impersonate Chrome 146 TLS fingerprint and calls
 * the Google Cloud TTS API via cxl-services.appspot.com proxy.
 *
 * Requires reCAPTCHA token for authentication.
 * Supports multiple tokens with random rotation and fallback on retry.
 *
 * Configuration (config.json):
 *   `providers.gemini-tts.tokens` - array of reCAPTCHA token strings
 *     Multiple tokens are rotated randomly with fallback on retry.
 *
 * Supported extra params:
 *   - voice (optional, default "Kore"): one of the Gemini-TTS voice names
 *   - model (optional, default "gemini-2.5-flash-tts"): Gemini-TTS model
 *   - language (optional, default "en-us"): BCP-47 language code
 *   - gender (optional): MALE / FEMALE / NEUTRAL
 *   - encoding (optional, default "LINEAR16"): audio encoding format
 *   - sample_rate (optional): sample rate in Hz
 *   - speed (optional): speaking rate [0.25 - 2.0]
 *   - pitch (optional): pitch in semitones [-20.0 - 20.0]
 *   - gain (optional): volume gain in dB [-96.0 - 16.0]
 *   - prompt (optional): voice style prompt
 *   - token (optional): per-request token, bypasses config and retry
 */

import { z } from 'zod';
import { createCuimpHttp } from 'cuimp';
import { OpenAiError } from '../errors.js';
import { OPENAI_ERROR_TYPE, OPENAI_ERROR_CODE } from '../types/openai.js';
import { tts_request_base } from '../types/schema.js';
import type { TtsProvider, SpeechParams, SpeechResult } from '../types/provider.js';

// -- Schema --

const gemini_tts_schema = tts_request_base.extend({
  voice: z.string().optional(),
  model: z.string().optional(),
  language: z.string().optional(),
  gender: z.string().optional(),
  encoding: z.string().optional(),
  sample_rate: z.number().int().positive().optional(),
  speed: z.number().optional(),
  pitch: z.number().optional(),
  gain: z.number().optional(),
  prompt: z.string().optional(),
  token: z.string().optional(),
});

// -- Constants --

const PROXY_BASE = 'https://cxl-services.appspot.com/proxy';
const TTS_URL = 'https://texttospeech.googleapis.com/v1beta1/text:synthesize';
/** Gemini TTS models that this provider supports as first-class model IDs. */
const GEMINI_MODELS = [
  'gemini-3.1-flash-tts-preview',
  'gemini-2.5-flash-tts',
  'gemini-2.5-pro-tts',
  'gemini-2.5-flash-lite-preview-tts',
  'chirp3-hd',
] as const;

const DEFAULT_GEMINI_VOICES = [
  'Achernar',
  'Achird',
  'Algenib',
  'Algieba',
  'Alnilam',
  'Aoede',
  'Autonoe',
  'Callirrhoe',
  'Charon',
  'Despina',
  'Enceladus',
  'Erinome',
  'Fenrir',
  'Gacrux',
  'Iapetus',
  'Kore',
  'Laomedeia',
  'Leda',
  'Orus',
  'Pulcherrima',
  'Puck',
  'Rasalgethi',
  'Sadachbia',
  'Sadaltager',
  'Schedar',
  'Sulafat',
  'Umbriel',
  'Vindemiatrix',
  'Zephyr',
  'Zubenelgenubi',
] as const;

const VALID_ENCODINGS = [
  'LINEAR16',
  'MP3',
  'MP3_64_KBPS',
  'OGG_OPUS',
  'MULAW',
  'ALAW',
  'PCM',
] as const;

const GEMINI_MIME: Record<string, string> = {
  LINEAR16: 'audio/L16; rate=24000; channels=1',
  MP3: 'audio/mpeg',
  MP3_64_KBPS: 'audio/mpeg',
  OGG_OPUS: 'audio/ogg; codecs=opus',
  MULAW: 'audio/basic',
  ALAW: 'audio/wav',
  PCM: 'audio/L16; rate=24000; channels=1',
};

const PROXY_HEADERS: Record<string, string> = {
  accept: '*/*',
  dnt: '1',
  origin: 'https://www.gstatic.com',
  referer: 'https://www.gstatic.com/',
};
PROXY_HEADERS['content-type'] = 'text/plain;charset=UTF-8';
PROXY_HEADERS['accept-language'] = 'zh-CN,zh;q=0.9';
PROXY_HEADERS['priority'] = 'u=1, i';
PROXY_HEADERS['sec-ch-ua'] = '"Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"';
PROXY_HEADERS['sec-ch-ua-mobile'] = '?0';
PROXY_HEADERS['sec-ch-ua-platform'] = '"Windows"';
PROXY_HEADERS['sec-fetch-dest'] = 'empty';
PROXY_HEADERS['sec-fetch-mode'] = 'cors';
PROXY_HEADERS['sec-fetch-site'] = 'cross-site';
PROXY_HEADERS['user-agent'] =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36';

interface CuimpResponse {
  status: number;
  headers: Record<string, string | string[]>;
  // eslint-disable-next-line @typescript-eslint/naming-convention -- matches cuimp API shape
  rawBody: Buffer | Uint8Array;
}

// -- Provider --

export class GeminiTtsProvider implements TtsProvider {
  readonly name = 'gemini-tts';
  readonly owned_by = 'google';
  request_schema = gemini_tts_schema;

  private tokens: string[];

  constructor(config?: Record<string, unknown>) {
    const raw = config?.tokens;
    if (Array.isArray(raw)) {
      this.tokens = raw.filter((t): t is string => typeof t === 'string' && t.length > 0);
    } else if (typeof raw === 'string') {
      this.tokens = [raw];
    } else {
      this.tokens = [];
    }
  }

  get_models(): string[] {
    return [...GEMINI_MODELS];
  }

  get_model_voices(_model: string): string[] {
    return [...DEFAULT_GEMINI_VOICES];
  }

  supports_model(model: string): boolean {
    return (
      model === 'gemini-tts' || GEMINI_MODELS.includes(model as (typeof GEMINI_MODELS)[number])
    );
  }

  async speak(params: SpeechParams): Promise<SpeechResult> {
    const voice = resolve_voice(params.extra['voice'] as string | undefined);
    const gemini_model = resolve_model(params.extra['model'] as string | undefined, params.model);
    const encoding = resolve_encoding(params.extra['encoding'] as string | undefined);
    const language = (params.extra['language'] as string | undefined) ?? 'en-us';
    const sample_rate = (params.extra['sample_rate'] as number | undefined) ?? 24000;

    const request_payload = build_tts_payload(
      params.input,
      voice,
      gemini_model,
      language,
      encoding,
      sample_rate,
      params.extra,
    );

    const req_token = params.extra['token'] as string | undefined;
    const pool: string[] = req_token ? [req_token] : [...this.tokens];
    const max_retries = req_token ? 0 : 3;

    if (pool.length === 0) {
      throw no_credential_error(
        'No tokens configured for gemini-tts. ' +
          'Add `providers.gemini-tts.tokens` to config.json.',
      );
    }

    for (let attempt = 0; ; attempt++) {
      if (pool.length === 0) {
        throw provider_error('authentication failed: all tokens rejected (401)', 502);
      }

      const token = attempt === 0 ? pool[0] : (pick_random(pool) ?? pool[0]);

      try {
        const response = await do_tts_request(request_payload, token);
        const status = response.status;

        if (status === 200) {
          const audio_data = decode_audio_content(response.rawBody);
          return build_speech_result(audio_data, encoding, sample_rate);
        }

        if (status === 401) {
          const idx = pool.indexOf(token);
          if (idx >= 0) pool.splice(idx, 1);
          if (pool.length === 0) {
            throw provider_error('authentication failed: all tokens rejected (401)', 502);
          }
          continue;
        }

        if (status === 429 || status === 500 || status === 503) {
          if (attempt >= max_retries) {
            throw provider_error(`returned ${status} after 3 retries`, 502);
          }
          await sleep(Math.pow(2, attempt + 1) * 1000 + Math.random() * 500);
          continue;
        }

        throw provider_error(`returned HTTP ${status}: ${preview_body(response.rawBody)}`, 502);
      } catch (err) {
        if (err instanceof OpenAiError) {
          throw err;
        }
        if (attempt >= max_retries) {
          throw provider_error(
            `request failed: ${err instanceof Error ? err.message : String(err)}`,
            502,
          );
        }
        await sleep(Math.pow(2, attempt + 1) * 1000 + Math.random() * 500);
      }
    }
  }
}

// -- Voice / model / encoding resolution --

function resolve_voice(voice: string | undefined): string {
  return voice ?? 'Kore';
}

function resolve_model(extra_model: string | undefined, request_model: string): string {
  if (extra_model) return extra_model;
  // Use request model directly if it's a known Gemini model
  if (GEMINI_MODELS.includes(request_model as (typeof GEMINI_MODELS)[number])) return request_model;
  return 'gemini-3.1-flash-tts-preview';
}

function resolve_encoding(encoding: string | undefined): string {
  if (!encoding) return 'LINEAR16';
  const upper = encoding.toUpperCase();
  for (const valid of VALID_ENCODINGS) {
    if (valid === upper) return valid;
  }
  return 'LINEAR16';
}

// -- Request building --

function build_tts_payload(
  text: string,
  voice: string,
  gemini_model: string,
  language: string,
  encoding: string,
  sample_rate: number,
  extra: Record<string, unknown>,
): string {
  const body: Record<string, unknown> = {
    input: { text },
    voice: { name: voice },
  };
  body['audioConfig'] = {};

  (body.voice as Record<string, unknown>)['languageCode'] = language;
  (body.voice as Record<string, unknown>)['modelName'] = gemini_model;
  (body.audioConfig as Record<string, unknown>)['audioEncoding'] = encoding;
  (body.audioConfig as Record<string, unknown>)['sampleRateHertz'] = sample_rate;

  const prompt = extra['prompt'] as string | undefined;
  if (prompt) {
    (body.input as Record<string, unknown>).prompt = prompt;
  }

  const gender = extra['gender'] as string | undefined;
  if (gender) {
    (body.voice as Record<string, unknown>).ssmlGender = gender.toUpperCase();
  }

  const speed = extra['speed'] as number | undefined;
  if (speed != null) {
    (body.audioConfig as Record<string, unknown>).speakingRate = speed;
  }

  const pitch = extra['pitch'] as number | undefined;
  if (pitch != null) {
    (body.audioConfig as Record<string, unknown>).pitch = pitch;
  }

  const gain = extra['gain'] as number | undefined;
  if (gain != null) {
    (body.audioConfig as Record<string, unknown>).volumeGainDb = gain;
  }

  const profile = extra['profile'] as string | undefined;
  if (profile) {
    (body.audioConfig as Record<string, unknown>).effectsProfileId = profile
      .split(',')
      .map((s: string) => s.trim());
  }

  return JSON.stringify(body);
}

// -- HTTP --

async function do_tts_request(body_str: string, token: string): Promise<CuimpResponse> {
  const request_url = `${PROXY_BASE}?url=${encodeURIComponent(TTS_URL)}&token=${token}`;

  const client = createCuimpHttp({
    descriptor: { browser: 'chrome', version: '146' },
  });

  return client.request({
    url: request_url,
    method: 'POST',
    headers: { ...PROXY_HEADERS },
    data: body_str,
    timeout: 30000,
  });
}

// -- Response handling --

function decode_audio_content(raw_body: Buffer | Uint8Array): Buffer {
  const body_buf = Buffer.from(raw_body);
  const text = body_buf.toString('utf-8');

  if (text.startsWith('data:')) {
    const stripped = text.replace(/^data:audio\/\w+;base64,/, '');
    return Buffer.from(stripped, 'base64');
  }

  if (text.startsWith('{') || text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text) as Record<string, unknown>;
      const b64 = parsed?.audioContent as string | undefined;
      if (typeof b64 === 'string') {
        return Buffer.from(b64, 'base64');
      }
    } catch {
      // Not valid JSON, fall through
    }
  }

  return Buffer.from(text.replace(/\s/g, ''), 'base64');
}

function build_speech_result(
  audio_data: Buffer,
  encoding: string,
  sample_rate: number,
): SpeechResult {
  const encoding_upper = encoding.toUpperCase();
  let mime = GEMINI_MIME[encoding_upper];
  if (!mime) {
    mime = 'audio/L16; rate=24000; channels=1';
  }

  mime = mime.replace(/rate=\d+/, `rate=${sample_rate}`);

  return {
    content_type: mime,
    data: audio_data,
  };
}

// -- Error helpers --

function no_credential_error(message?: string): OpenAiError {
  return new OpenAiError(
    message ?? 'No valid tokens configured for gemini-tts.',
    OPENAI_ERROR_TYPE.PROVIDER,
    null,
    OPENAI_ERROR_CODE.PROVIDER_UNAVAILABLE,
    502,
  );
}

function provider_error(message: string, status_code: number): OpenAiError {
  return new OpenAiError(
    `gemini-tts ${message}`,
    OPENAI_ERROR_TYPE.PROVIDER,
    null,
    OPENAI_ERROR_CODE.PROVIDER_UNAVAILABLE,
    status_code,
  );
}

function preview_body(body: Buffer | Uint8Array | undefined): string {
  if (!body) return '';
  return Buffer.from(body).toString('utf-8').slice(0, 300);
}

// -- General helpers --

function pick_random<T>(items: T[]): T | undefined {
  if (items.length === 0) return undefined;
  return items[Math.floor(Math.random() * items.length)];
}

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
