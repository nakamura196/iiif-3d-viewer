// お知らせを書き足したときに、書き漏れ（片方の言語・重複した id・存在しないユースケース）を見つけるテスト。
import { describe, expect, it } from 'vitest';
import { NEWS, actionHrefOf, relatedUseCasesOf } from './news';

describe('NEWS', () => {
  it('id は重複せず、URL に使える形', () => {
    const ids = NEWS.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('新しいものが上（日付が降順）', () => {
    const dates = NEWS.map((n) => n.date);
    for (const d of dates) expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect([...dates].sort().reverse()).toEqual(dates);
  });

  it('見出しと本文が日英とも書いてある', () => {
    for (const n of NEWS) {
      for (const s of [n.title.ja, n.title.en, n.body.ja, n.body.en]) expect(s.trim(), n.id).not.toBe('');
    }
  });

  it('関連するユースケースは実在する', () => {
    for (const n of NEWS) expect(relatedUseCasesOf(n)).toHaveLength(n.usecases?.length ?? 0);
  });

  it('「試す」はサイト内のパスか、外部なら https', () => {
    for (const n of NEWS) {
      if (!n.action) continue;
      for (const l of ['ja', 'en'] as const) {
        const href = actionHrefOf(n.action, l);
        if (n.action.external) expect(new URL(href).protocol).toBe('https:');
        else expect(href, n.id).toMatch(/^\//);
      }
    }
  });

  it('動画の videoId は YouTube の 11 文字', () => {
    for (const n of NEWS) {
      for (const v of Object.values(n.video ?? {})) expect(v).toMatch(/^[A-Za-z0-9_-]{11}$/);
    }
  });
});
