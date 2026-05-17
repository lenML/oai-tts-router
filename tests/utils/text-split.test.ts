/**
 * Text splitting tests.
 */

import { describe, it, expect } from 'vitest';
import { split_text, is_cjk_text } from '../../src/utils/text-split.js';

describe('split_text', () => {
  it('should return the original text if within max_length', () => {
    const result = split_text('Hello world', 100);
    expect(result).toEqual(['Hello world']);
  });

  it('should not split text at exactly max_length', () => {
    const result = split_text('1234567890', 10);
    expect(result).toEqual(['1234567890']);
  });

  it('should split at sentence boundary (period)', () => {
    const text = 'First sentence. Second sentence. Third.';
    const result = split_text(text, 20);
    expect(result).toEqual(['First sentence.', ' Second sentence.', ' Third.']);
  });

  it('should split at sentence boundary (exclamation)', () => {
    const text = 'Hello! World! Test!';
    const result = split_text(text, 10);
    expect(result).toEqual(['Hello!', ' World!', ' Test!']);
  });

  it('should split at sentence boundary (question mark)', () => {
    const text = 'How are you? I am fine. Good.';
    const result = split_text(text, 15);
    expect(result).toEqual(['How are you?', ' I am fine.', ' Good.']);
  });

  it('should split at Chinese period', () => {
    const text = '你好。世界。测试。';
    const result = split_text(text, 5);
    expect(result).toEqual(['你好。', '世界。', '测试。']);
  });

  it('should split at Chinese question mark', () => {
    const text = '你好吗？我很好。谢谢。';
    const result = split_text(text, 6);
    expect(result).toEqual(['你好吗？', '我很好。', '谢谢。']);
  });

  it('should split at word boundary when no sentence boundary', () => {
    const text = 'The quick brown fox jumps over the lazy dog';
    const result = split_text(text, 15);
    expect(result.length).toBeGreaterThan(1);
    // Each chunk should be <= 15 chars
    for (const chunk of result) {
      expect(chunk.length).toBeLessThanOrEqual(15);
    }
    // Should preserve all content
    expect(result.join('')).toBe(text);
  });

  it('should hard split when no word boundary found within limit', () => {
    const text = 'aaaaaaaaaaaaaaaaaaaaaaaaaa';
    const result = split_text(text, 10);
    expect(result).toEqual(['aaaaaaaaaa', 'aaaaaaaaaa', 'aaaaaa']);
  });

  it('should handle mixed CJK and English', () => {
    const text = 'Hello world. 这是一段测试文本。Another sentence here.';
    const result = split_text(text, 20);
    for (const chunk of result) {
      expect(chunk.length).toBeLessThanOrEqual(20);
    }
    expect(result.join('')).toBe(text);
  });

  it('should split on newline boundaries', () => {
    const text = 'line one\nline two\nline three';
    const result = split_text(text, 10);
    expect(result).toEqual(['line one\n', 'line two\n', 'line three']);
  });

  it('should split long text into multiple chunks preserving content', () => {
    const sentence = 'The quick brown fox. ';
    const text = sentence.repeat(50);
    const result = split_text(text, 100);
    const joined = result.join('');
    expect(joined).toBe(text);
    expect(result.length).toBeGreaterThan(1);
    for (const chunk of result) {
      expect(chunk.length).toBeLessThanOrEqual(100);
    }
  });

  it('should handle empty string', () => {
    const result = split_text('', 10);
    expect(result).toEqual(['']);
  });

  it('should handle single character', () => {
    const result = split_text('a', 1);
    expect(result).toEqual(['a']);
  });
});

describe('is_cjk_text', () => {
  it('should return true for Chinese text', () => {
    expect(is_cjk_text('你好世界')).toBe(true);
  });

  it('should return true for mixed CJK text', () => {
    expect(is_cjk_text('你好 world 测试')).toBe(true);
  });

  it('should return false for English text', () => {
    expect(is_cjk_text('Hello world test')).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(is_cjk_text('')).toBe(false);
  });

  it('should return true for Japanese hiragana', () => {
    expect(is_cjk_text('こんにちは世界')).toBe(true);
  });

  it('should return true for Korean hangul', () => {
    expect(is_cjk_text('안녕하세요 세계')).toBe(true);
  });
});
