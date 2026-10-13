import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { pickLocale, localizedUrl } from './locale';

describe('pickLocale', () => {
  it('日本語を希望していれば ja', () => {
    expect(pickLocale(['ja-JP', 'en-US'])).toBe('ja');
  });

  it('英語を希望していれば en', () => {
    expect(pickLocale(['en-GB'])).toBe('en');
  });

  it('優先順に見て、先に来た対応言語を選ぶ', () => {
    expect(pickLocale(['fr-FR', 'en', 'ja'])).toBe('en');
    expect(pickLocale(['de', 'ja', 'en'])).toBe('ja');
  });

  it('対応言語が無ければ英語', () => {
    expect(pickLocale(['fr', 'zh-CN'])).toBe('en');
    expect(pickLocale([])).toBe('en');
  });
});

describe('localizedUrl', () => {
  const original = process.env.NEXT_PUBLIC_BASE_PATH;
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_BASE_PATH;
  });
  afterEach(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_BASE_PATH;
    else process.env.NEXT_PUBLIC_BASE_PATH = original;
  });

  it('クエリと # を落とさずに言語パスを付ける', () => {
    const search = '?iiif-content=https%3A%2F%2Fexample.org%2Fmanifest.json';
    expect(localizedUrl('en', '/viewer/', search, '#a')).toBe(`/en/viewer/${search}#a`);
  });

  it('トップは /<言語>/ になる', () => {
    expect(localizedUrl('ja', '/')).toBe('/ja/');
  });

  it('GH Pages (basePath あり) では basePath を前置する', () => {
    process.env.NEXT_PUBLIC_BASE_PATH = '/iiif-kasane';
    expect(localizedUrl('en', '/viewer/', '?x=1')).toBe('/iiif-kasane/en/viewer/?x=1');
  });
});
