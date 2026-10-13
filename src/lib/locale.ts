import { withBasePath } from './basePath';

export type Locale = 'en' | 'ja';

// 言語パスの無い URL (/ や /viewer/) に来た人を振り分けるときの既定。
// cookbook など海外から来る人が多いので、日本語を希望していなければ英語にする。
export const FALLBACK_LOCALE: Locale = 'en';

// ブラウザの希望言語 (navigator.languages、優先順) から、対応している言語を選ぶ。
// 'ja-JP' や 'en-GB' のような地域付きの指定も、前半だけで判定する。
export function pickLocale(languages: readonly string[]): Locale {
  for (const lang of languages) {
    const primary = lang.toLowerCase().split('-')[0];
    if (primary === 'ja' || primary === 'en') return primary;
  }
  return FALLBACK_LOCALE;
}

// 言語パスを付けた行き先を組み立てる。?iiif-content=... と #... はそのまま引き継ぐ。
export function localizedUrl(locale: Locale, path: string, search = '', hash = ''): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${withBasePath(`/${locale}${p}`)}${search}${hash}`;
}
