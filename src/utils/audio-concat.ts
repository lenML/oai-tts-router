/**
 * Audio concatenation utilities.
 * Supports WAV and MP3 without external dependencies (no ffmpeg).
 *
 * WAV: Strip headers from subsequent chunks, concatenate raw PCM data.
 * MP3: Simple binary concatenation (MP3 frames are self-contained).
 */

/**
 * WAV file header structure (44 bytes for PCM).
 * Parsed to verify compatibility and adjust size fields.
 */
interface WavHeader {
  riff_size: number;
  audio_format: number;
  num_channels: number;
  sample_rate: number;
  byte_rate: number;
  block_align: number;
  bits_per_sample: number;
  data_size: number;
}

/** Size of a standard PCM WAV header (before data) */
const WAV_HEADER_SIZE = 44;

/**
 * Parse a WAV header from a buffer.
 * Returns null if the buffer is too small or has an invalid RIFF signature.
 */
function parse_wav_header(buf: Buffer): WavHeader | null {
  if (buf.length < WAV_HEADER_SIZE) return null;
  if (buf.toString('ascii', 0, 4) !== 'RIFF') return null;
  if (buf.toString('ascii', 8, 12) !== 'WAVE') return null;
  if (buf.toString('ascii', 12, 16) !== 'fmt ') return null;

  return {
    riff_size: buf.readUInt32LE(4),
    audio_format: buf.readUInt16LE(20),
    num_channels: buf.readUInt16LE(22),
    sample_rate: buf.readUInt32LE(24),
    byte_rate: buf.readUInt32LE(28),
    block_align: buf.readUInt16LE(32),
    bits_per_sample: buf.readUInt16LE(34),
    data_size: buf.readUInt32LE(40),
  };
}

/**
 * Get the raw audio data from a WAV buffer (skip header).
 */
function wav_data(buf: Buffer): Buffer {
  const data_start = find_data_chunk(buf);
  return data_start >= 0 ? buf.subarray(data_start + 8) : buf.subarray(WAV_HEADER_SIZE);
}

/**
 * Find the "data" chunk position in a WAV file.
 * Standard PCM WAV has data at offset 44, but some have extra chunks.
 */
function find_data_chunk(buf: Buffer): number {
  if (buf.length < 12) return -1;
  let offset = 12; // skip RIFF header

  while (offset + 8 <= buf.length) {
    const chunk_id = buf.toString('ascii', offset, offset + 4);
    const chunk_size = buf.readUInt32LE(offset + 4);

    if (chunk_id === 'data') {
      return offset;
    }

    offset += 8 + chunk_size;
    // Pad to even boundary
    if (chunk_size % 2 !== 0) offset++;
  }

  return -1;
}

/**
 * Concatenate multiple WAV buffers into a single WAV file.
 * All inputs must have the same audio format (sample rate, channels, bit depth).
 * Throws on incompatible formats.
 */
export function concat_wav(buffers: Buffer[]): Buffer {
  if (buffers.length === 0) {
    throw new Error('Cannot concatenate zero WAV buffers');
  }
  // Parse and validate headers
  const headers = buffers.map(parse_wav_header);
  for (let i = 0; i < headers.length; i++) {
    if (!headers[i]) {
      throw new Error(`Buffer ${i} is not a valid WAV file`);
    }
  }

  const ref = headers[0]!;

  // Validate format compatibility
  for (let i = 1; i < headers.length; i++) {
    const h = headers[i]!;
    if (h.audio_format !== ref.audio_format) {
      throw new Error(
        `WAV format mismatch: buffer 0 is format ${ref.audio_format}, buffer ${i} is ${h.audio_format}`,
      );
    }
    if (h.sample_rate !== ref.sample_rate) {
      throw new Error(
        `WAV sample rate mismatch: buffer 0 is ${ref.sample_rate}, buffer ${i} is ${h.sample_rate}`,
      );
    }
    if (h.num_channels !== ref.num_channels) {
      throw new Error(
        `WAV channel mismatch: buffer 0 has ${ref.num_channels}, buffer ${i} has ${h.num_channels}`,
      );
    }
    if (h.bits_per_sample !== ref.bits_per_sample) {
      throw new Error(
        `WAV bit depth mismatch: buffer 0 is ${ref.bits_per_sample}, buffer ${i} is ${h.bits_per_sample}`,
      );
    }
  }

  // Calculate total data size
  let total_data_size = 0;
  const data_parts: Buffer[] = [];

  for (let i = 0; i < buffers.length; i++) {
    const data = wav_data(buffers[i]);
    data_parts.push(data);
    total_data_size += data.length;
  }

  // Build the output header from the first file
  const header = Buffer.from(buffers[0].subarray(0, WAV_HEADER_SIZE)); // copy
  const new_riff_size = total_data_size + 36; // 36 = WAV header size after RIFF size field
  const new_data_size = total_data_size;

  header.writeUInt32LE(new_riff_size, 4);

  // Find and update the data chunk size
  const data_chunk_pos = find_data_chunk(header);
  if (data_chunk_pos >= 0) {
    header.writeUInt32LE(new_data_size, data_chunk_pos + 4);
  } else {
    // Fallback: update at standard offset 40
    header.writeUInt32LE(new_data_size, 40);
  }

  return Buffer.concat([header, ...data_parts]);
}

/**
 * Concatenate multiple MP3 buffers into a single MP3 file.
 * MP3 frames are self-contained, so simple concatenation works.
 * However, the resulting file may have incorrect duration metadata.
 */
export function concat_mp3(buffers: Buffer[]): Buffer {
  if (buffers.length === 0) {
    throw new Error('Cannot concatenate zero MP3 buffers');
  }
  if (buffers.length === 1) {
    return buffers[0];
  }

  return Buffer.concat(buffers);
}

/**
 * Detect whether a content-type indicates WAV audio.
 */
export function is_wav_content_type(content_type: string): boolean {
  return content_type.includes('wav') || content_type.includes('wave');
}

/**
 * Detect whether a content-type indicates MP3 audio.
 */
export function is_mp3_content_type(content_type: string): boolean {
  return content_type.includes('mpeg') || content_type.includes('mp3');
}

/**
 * Concatenate audio buffers, auto-detecting format from content_type.
 * Only WAV and MP3 are supported.
 */
export function concat_audio(buffers: SpeechResultWithType[]): SpeechResultWithType {
  if (buffers.length === 0) {
    throw new Error('No audio buffers to concatenate');
  }
  if (buffers.length === 1) {
    return buffers[0];
  }

  const first = buffers[0];
  const ct = first.content_type;

  if (is_wav_content_type(ct)) {
    // Verify all are WAV
    for (let i = 1; i < buffers.length; i++) {
      if (!is_wav_content_type(buffers[i].content_type)) {
        throw new Error(
          `Cannot concatenate mixed formats: buffer 0 is WAV but buffer ${i} is ${buffers[i].content_type}`,
        );
      }
    }
    return {
      content_type: ct,
      data: concat_wav(buffers.map(b => b.data)),
    };
  }

  if (is_mp3_content_type(ct)) {
    for (let i = 1; i < buffers.length; i++) {
      if (!is_mp3_content_type(buffers[i].content_type)) {
        throw new Error(
          `Cannot concatenate mixed formats: buffer 0 is MP3 but buffer ${i} is ${buffers[i].content_type}`,
        );
      }
    }
    return {
      content_type: ct,
      data: concat_mp3(buffers.map(b => b.data)),
    };
  }

  throw new Error(`Audio concatenation only supports WAV and MP3, got: ${ct}`);
}

/** Internal type for audio result with content_type */
interface SpeechResultWithType {
  content_type: string;
  data: Buffer;
}
