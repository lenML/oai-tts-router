/**
 * Language-aware text splitting for TTS.
 *
 * Splits long text into chunks at sentence or word boundaries
 * so each chunk fits within max_length characters.
 *
 * Strategy (in order of preference):
 * 1. Split at sentence boundaries (。！？.!?\n)
 * 2. If a segment exceeds max_length, split at the last word boundary within the limit
 * 3. If no word boundary exists, hard split at max_length
 */

/** Characters considered sentence terminators */
const SENTENCE_TERMINATORS = new Set([
  '.',
  '!',
  '?',
  '\n',
  '\r',
  '\u3002', // Chinese period 。
  '\uff01', // Chinese exclamation ！
  '\uff1f', // Chinese question ？
]);

/** Characters considered word boundaries */
const WORD_BOUNDARIES = new Set([
  ' ',
  '\t',
  '\n',
  '\r',
  ',',
  ';',
  ':',
  '\u3001', // Chinese comma 、
  '\u3002', // Chinese period 。
  '\uff0c', // Chinese comma ，
  '\uff01', // Chinese exclamation ！
  '\uff1f', // Chinese question ？
  '\u2014', // em dash —
  '\u2013', // en dash –
  '\u300a', // left book title mark 《
  '\u300b', // right book title mark 》
  '\u201c', // left double quote "
  '\u201d', // right double quote "
  '\u2018', // left single quote '
  '\u2019', // right single quote '
  '（',
  '）',
  '(',
  ')',
]);

function is_sentence_terminator(ch: string): boolean {
  return SENTENCE_TERMINATORS.has(ch);
}

function is_word_boundary(ch: string): boolean {
  return WORD_BOUNDARIES.has(ch);
}

/**
 * Split text into chunks that fit within max_length.
 * Preserves chunk ordering for concatenation.
 */
export function split_text(text: string, max_length: number): string[] {
  if (text.length <= max_length) {
    return [text];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const remaining = text.length - start;

    if (remaining <= max_length) {
      chunks.push(text.slice(start));
      break;
    }

    const end = find_split_boundary(text, start, max_length);
    chunks.push(text.slice(start, end));
    start = end;
  }

  return chunks;
}

/**
 * Find the best position to split text[start .. start+max_length].
 * Favors sentence boundaries > word boundaries > hard split.
 */
function find_split_boundary(text: string, start: number, max_length: number): number {
  const end = start + max_length;
  const segment = text.slice(start, end);

  // 1. Try sentence boundary (search backwards from end)
  for (let i = segment.length - 1; i >= 0; i--) {
    if (is_sentence_terminator(segment[i])) {
      // Include the terminator in the current chunk
      return start + i + 1;
    }
  }

  // 2. Try word boundary (search backwards from end)
  for (let i = segment.length - 1; i >= 0; i--) {
    if (is_word_boundary(segment[i])) {
      return start + i + 1;
    }
  }

  // 3. Hard split at max_length
  return end;
}

/**
 * Check if text appears to be CJK (Chinese/Japanese/Korean).
 * Used to adjust splitting strategy.
 */
export function is_cjk_text(text: string): boolean {
  // Check if more than 30% of characters are in CJK ranges
  let cjk_count = 0;
  let total = 0;

  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    const is_cjk =
      (code >= 0x4e00 && code <= 0x9fff) || // CJK Unified Ideographs
      (code >= 0x3400 && code <= 0x4dbf) || // CJK Extension A
      (code >= 0xf900 && code <= 0xfaff) || // CJK Compatibility
      (code >= 0xac00 && code <= 0xd7af) || // Hangul
      (code >= 0x3040 && code <= 0x309f) || // Hiragana
      (code >= 0x30a0 && code <= 0x30ff); // Katakana

    if (is_cjk) {
      cjk_count++;
    }
    total++;
  }

  return total > 0 && cjk_count / total > 0.3;
}
