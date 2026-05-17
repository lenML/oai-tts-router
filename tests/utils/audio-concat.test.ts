/**
 * Audio concatenation tests.
 */

import { describe, it, expect } from 'vitest';
import {
  concat_wav,
  concat_mp3,
  concat_audio,
  is_wav_content_type,
  is_mp3_content_type,
} from '../../src/utils/audio-concat.js';

/**
 * Create a minimal valid WAV buffer with PCM audio data.
 * Format: 16-bit mono, 44100 Hz (standard CD quality).
 */
function create_wav_buffer(
  data_size: number,
  overrides?: Partial<{
    num_channels: number;
    sample_rate: number;
    bits_per_sample: number;
    audio_format: number;
  }>,
): Buffer {
  const {
    num_channels = 1,
    sample_rate = 44100,
    bits_per_sample = 16,
    audio_format = 1,
  } = overrides ?? {};
  const bytes_per_sample = bits_per_sample / 8;
  const block_align = num_channels * bytes_per_sample;
  const byte_rate = sample_rate * block_align;

  // Generate raw audio data
  const raw_data = Buffer.alloc(data_size);
  for (let i = 0; i < raw_data.length; i++) {
    raw_data[i] = (i * 7 + 13) & 0xff; // deterministic pseudo-random data
  }

  // 44-byte header + data
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + data_size, 4); // file size - 8
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16); // fmt chunk size
  header.writeUInt16LE(audio_format, 20);
  header.writeUInt16LE(num_channels, 22);
  header.writeUInt32LE(sample_rate, 24);
  header.writeUInt32LE(byte_rate, 28);
  header.writeUInt16LE(block_align, 32);
  header.writeUInt16LE(bits_per_sample, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(data_size, 40);

  return Buffer.concat([header, raw_data]);
}

describe('is_wav_content_type', () => {
  it('should detect wav content type', () => {
    expect(is_wav_content_type('audio/wav')).toBe(true);
    expect(is_wav_content_type('audio/wave')).toBe(true);
    expect(is_wav_content_type('audio/x-wav')).toBe(true);
  });

  it('should reject mp3 content type', () => {
    expect(is_wav_content_type('audio/mpeg')).toBe(false);
  });
});

describe('is_mp3_content_type', () => {
  it('should detect mp3 content type', () => {
    expect(is_mp3_content_type('audio/mpeg')).toBe(true);
    expect(is_mp3_content_type('audio/mp3')).toBe(true);
  });

  it('should reject wav content type', () => {
    expect(is_mp3_content_type('audio/wav')).toBe(false);
  });
});

describe('concat_wav', () => {
  it('should return the same buffer for single input', () => {
    const buf = create_wav_buffer(100);
    const result = concat_wav([buf]);
    expect(result).toEqual(buf);
  });

  it('should concatenate two WAV files', () => {
    const buf1 = create_wav_buffer(100);
    const buf2 = create_wav_buffer(200);
    const result = concat_wav([buf1, buf2]);

    // Total data: 100 + 200 = 300
    // Header: 44 bytes total
    // RIFF size: 300 + 36 = 336
    // Data chunk size: 300
    expect(result.readUInt32LE(4)).toBe(336); // RIFF size
    expect(result.readUInt32LE(40)).toBe(300); // data chunk size
    expect(result.length).toBe(44 + 300);
  });

  it('should concatenate multiple WAV files', () => {
    const bufs = [create_wav_buffer(50), create_wav_buffer(70), create_wav_buffer(90)];
    const result = concat_wav(bufs);

    const total_data = 50 + 70 + 90;
    expect(result.readUInt32LE(40)).toBe(total_data);
    expect(result.length).toBe(44 + total_data);
  });

  it('should preserve audio format metadata from the first file', () => {
    const buf1 = create_wav_buffer(100, {
      num_channels: 1,
      sample_rate: 44100,
      bits_per_sample: 16,
    });
    const buf2 = create_wav_buffer(100);
    const result = concat_wav([buf1, buf2]);

    expect(result.readUInt16LE(20)).toBe(1); // PCM
    expect(result.readUInt16LE(22)).toBe(1); // mono
    expect(result.readUInt32LE(24)).toBe(44100); // sample rate
    expect(result.readUInt16LE(34)).toBe(16); // bits per sample
  });

  it('should throw if buffers have different sample rates', () => {
    const buf1 = create_wav_buffer(100, { sample_rate: 44100 });
    const buf2 = create_wav_buffer(100, { sample_rate: 48000 });
    expect(() => concat_wav([buf1, buf2])).toThrow('sample rate');
  });

  it('should throw if buffers have different channels', () => {
    const buf1 = create_wav_buffer(100, { num_channels: 1 });
    const buf2 = create_wav_buffer(100, { num_channels: 2 });
    expect(() => concat_wav([buf1, buf2])).toThrow('channel');
  });

  it('should throw if buffers have different bit depths', () => {
    const buf1 = create_wav_buffer(100, { bits_per_sample: 16 });
    const buf2 = create_wav_buffer(100, { bits_per_sample: 24 });
    expect(() => concat_wav([buf1, buf2])).toThrow('bit depth');
  });

  it('should throw for invalid WAV', () => {
    const invalid = Buffer.from('not a wav file');
    expect(() => concat_wav([invalid])).toThrow('WAV');
  });

  it('should throw for empty array', () => {
    expect(() => concat_wav([])).toThrow('zero');
  });

  it('should produce playable audio data (all samples preserved)', () => {
    const buf1 = create_wav_buffer(100);
    const buf2 = create_wav_buffer(150);
    const result = concat_wav([buf1, buf2]);

    // Check that raw data matches (first buffer's data + second buffer's data)
    const raw1 = buf1.subarray(44);
    const raw2 = buf2.subarray(44);
    const result_raw = result.subarray(44);

    expect(result_raw.subarray(0, 100)).toEqual(raw1);
    expect(result_raw.subarray(100, 250)).toEqual(raw2);
  });
});

describe('concat_mp3', () => {
  it('should return the same buffer for single input', () => {
    const buf = Buffer.from('fake mp3 data');
    const result = concat_mp3([buf]);
    expect(result).toEqual(buf);
  });

  it('should concatenate multiple MP3 buffers', () => {
    const buf1 = Buffer.from('mp3-part-1');
    const buf2 = Buffer.from('mp3-part-2');
    const buf3 = Buffer.from('mp3-part-3');
    const result = concat_mp3([buf1, buf2, buf3]);

    expect(result.toString()).toBe('mp3-part-1mp3-part-2mp3-part-3');
  });

  it('should throw for empty array', () => {
    expect(() => concat_mp3([])).toThrow('zero');
  });
});

describe('concat_audio', () => {
  it('should auto-detect WAV and concatenate', () => {
    const buf1 = create_wav_buffer(100);
    const buf2 = create_wav_buffer(200);
    const result = concat_audio([
      { content_type: 'audio/wav', data: buf1 },
      { content_type: 'audio/wav', data: buf2 },
    ]);

    expect(result.content_type).toBe('audio/wav');
    expect(result.data.length).toBe(44 + 300);
  });

  it('should auto-detect MP3 and concatenate', () => {
    const result = concat_audio([
      { content_type: 'audio/mpeg', data: Buffer.from('mp3-a') },
      { content_type: 'audio/mpeg', data: Buffer.from('mp3-b') },
    ]);

    expect(result.content_type).toBe('audio/mpeg');
    expect(result.data.toString()).toBe('mp3-amp3-b');
  });

  it('should return single buffer as-is', () => {
    const buf = create_wav_buffer(100);
    const result = concat_audio([{ content_type: 'audio/wav', data: buf }]);
    expect(result.data).toEqual(buf);
  });

  it('should throw for unsupported format', () => {
    expect(() =>
      concat_audio([
        { content_type: 'audio/ogg', data: Buffer.from('ogg') },
        { content_type: 'audio/ogg', data: Buffer.from('ogg2') },
      ]),
    ).toThrow('only supports WAV and MP3');
  });

  it('should throw for mixed formats', () => {
    expect(() =>
      concat_audio([
        { content_type: 'audio/wav', data: create_wav_buffer(100) },
        { content_type: 'audio/mpeg', data: Buffer.from('mp3') },
      ]),
    ).toThrow('mixed formats');
  });

  it('should throw for empty array', () => {
    expect(() => concat_audio([])).toThrow('No audio buffers');
  });
});
