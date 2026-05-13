/**
 * Language detection utility.
 * Uses franc (ISO 639-3) and maps to Google TTS language codes.
 */

import { franc } from 'franc';

/** franc ISO 639-3 → Google TTS language code mapping */
const FRANC_TO_GOOGLE: Record<string, string> = {
  eng: 'en',
  cmn: 'zh-CN',
  jpn: 'ja',
  kor: 'ko',
  rus: 'ru',
  ara: 'ar',
  arb: 'ar',
  tha: 'th',
  spa: 'es',
  fra: 'fr',
  deu: 'de',
  ita: 'it',
  por: 'pt',
  nld: 'nl',
  tur: 'tr',
  vie: 'vi',
  hin: 'hi',
  ben: 'bn',
  msa: 'ms',
  ind: 'id',
  bul: 'bg',
  ces: 'cs',
  dan: 'da',
  fin: 'fi',
  ell: 'el',
  hun: 'hu',
  nor: 'no',
  pol: 'pl',
  ron: 'ro',
  slk: 'sk',
  swe: 'sv',
  ukr: 'uk',
  yue: 'zh-CN',
};

/** Detect language code for Google TTS from text. Falls back to 'en'. */
export function detect_language(text: string): string {
  if (text.length === 0) {
    return 'en';
  }
  // eslint-disable-next-line @typescript-eslint/naming-convention
  const code = franc(text, { minLength: 1 });
  if (code === 'und') {
    return 'en';
  }
  return FRANC_TO_GOOGLE[code] ?? 'en';
}
