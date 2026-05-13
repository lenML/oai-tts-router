/**
 * Language detection tests using franc.
 */

import { describe, it, expect } from 'vitest';
import { detect_language } from '../../src/utils/lang.js';

describe('detect_language', () => {
  it('should return en for empty text', () => {
    expect(detect_language('')).toBe('en');
  });

  it('should detect English sentences', () => {
    expect(detect_language('Hello, this is a test of the text to speech system.')).toBe('en');
  });

  it('should detect Chinese', () => {
    expect(detect_language('你好，世界！这是一个测试。')).toBe('zh-CN');
  });

  it('should detect Japanese', () => {
    expect(detect_language('こんにちは、世界。これはテストです。')).toBe('ja');
  });

  it('should detect Korean', () => {
    expect(detect_language('안녕하세요, 세계. 이것은 테스트입니다.')).toBe('ko');
  });

  it('should detect Russian', () => {
    expect(detect_language('Русский язык является одним из самых распространённых в мире.')).toBe(
      'ru',
    );
  });

  it('should detect Arabic', () => {
    expect(detect_language('مرحبا بالعالم هذا اختبار')).toBe('ar');
  });

  it('should detect Thai', () => {
    expect(detect_language('สวัสดีชาวโลก นี่คือการทดสอบ')).toBe('th');
  });
});
