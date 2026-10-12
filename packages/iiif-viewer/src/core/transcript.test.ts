import { describe, expect, it } from 'vitest';
import type { SupplementingContent } from './services/containers';
import { isCaptions, transcriptOf } from './transcript';

const s = (o: Partial<SupplementingContent>): SupplementingContent => ({
  id: o.url ?? 'x',
  provides: [],
  url: 'https://e.org/a.txt',
  language: [],
  ...o,
});

describe('transcriptOf', () => {
  it('明示された transcript を選ぶ', () => {
    const t = s({ url: 'https://e.org/t.txt', provides: ['transcript'], format: 'text/plain' });
    const c = s({ url: 'https://e.org/c.vtt', provides: ['closedCaptions'], format: 'text/vtt' });
    expect(transcriptOf([c, t])).toBe(t);
  });
  it('transcript が無ければ字幕の VTT を使う（0219）', () => {
    const c = s({ url: 'https://e.org/c.vtt', provides: ['closedCaptions'], format: 'text/vtt' });
    expect(transcriptOf([c])).toBe(c);
  });
  it('provides の無い text/plain は文字起こし（0253）', () => {
    const t = s({ format: 'text/plain' });
    expect(transcriptOf([t])).toBe(t);
  });
  it('字幕より、provides の無いテキストを先にする', () => {
    const c = s({ url: 'https://e.org/c.vtt', provides: ['subtitles'], format: 'text/vtt' });
    const t = s({ format: 'text/plain' });
    expect(transcriptOf([c, t])).toBe(t);
  });
  it('何も無ければ undefined', () => {
    expect(transcriptOf([])).toBeUndefined();
    expect(transcriptOf([s({ provides: ['other'], format: 'text/html' })])).toBeUndefined();
  });
});

describe('isCaptions', () => {
  it('拡張子が .vtt でも字幕と判定する', () => {
    expect(isCaptions(s({ url: 'https://e.org/c.vtt?x=1', provides: ['closedCaptions'] }))).toBe(true);
    expect(isCaptions(s({ url: 'https://e.org/c.txt', provides: ['closedCaptions'] }))).toBe(false);
  });
});
