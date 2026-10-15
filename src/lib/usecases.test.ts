// ユースケースの一覧を書き足したときに、書き漏れ（片方の言語・札の表示名・重複した id）を見つけるテスト。
import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import ja from '@/messages/ja.json';
import en from '@/messages/en.json';
import { FEATURED_USE_CASES, USE_CASES, USE_CASE_FEATURES, byNewest, hrefOf, sourcesOf, usecaseById, videoOf } from './usecases';
import { isViewerTab } from './viewerTabs';

describe('USE_CASES', () => {
  it('開いたあとに選ぶタブは、ビューアに実在するタブ', () => {
    for (const u of USE_CASES) {
      const tab = (u.open as { tab?: string } | undefined)?.tab;
      if (tab) expect(isViewerTab(tab), `${u.id}: ${tab}`).toBe(true);
    }
  });

  it('id は重複せず、ページ内リンクに使える形', () => {
    const ids = USE_CASES.map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('見出しと説明が日英とも書いてある', () => {
    for (const u of USE_CASES) {
      for (const s of [u.title.ja, u.title.en, u.note.ja, u.note.en]) expect(s.trim()).not.toBe('');
    }
  });

  it('トップに出す例には、日英の見出しがある', () => {
    for (const u of FEATURED_USE_CASES) {
      for (const s of [u.headline?.ja, u.headline?.en]) expect(s?.trim(), u.id).toBeTruthy();
    }
  });

  it('マニフェストと元のページは https の URL', () => {
    for (const u of USE_CASES) {
      for (const s of sourcesOf(u.open)) expect(new URL(s).protocol).toBe('https:');
      if (u.site) expect(new URL(u.site).protocol).toBe('https:');
    }
  });

  it('動画の videoId は YouTube の 11 文字', () => {
    for (const u of USE_CASES) {
      for (const v of Object.values(u.video ?? {})) expect(v).toMatch(/^[A-Za-z0-9_-]{11}$/);
    }
  });

  it('札が 1 つ以上あり、どの札にも日英の表示名がある', () => {
    for (const u of USE_CASES) expect(u.features.length).toBeGreaterThan(0);
    for (const f of USE_CASE_FEATURES) {
      expect(ja.UseCases.features[f]).toBeTruthy();
      expect(en.UseCases.features[f]).toBeTruthy();
    }
  });

  it('入力欄に出すのは多すぎない数', () => {
    expect(FEATURED_USE_CASES.length).toBeGreaterThan(0);
    expect(FEATURED_USE_CASES.length).toBeLessThanOrEqual(6);
  });
});

describe('hrefOf', () => {
  const m = 'https://example.org/manifest.json';
  const enc = encodeURIComponent(m);

  it('viewer はタブとキュレーションの位置を載せる', () => {
    expect(hrefOf({ page: 'viewer', manifest: m })).toBe(`/viewer?iiif-content=${enc}`);
    expect(hrefOf({ page: 'viewer', manifest: m, tab: 'structure', pos: 4 })).toBe(
      `/viewer?iiif-content=${enc}&tab=structure&pos=4`,
    );
    expect(hrefOf({ page: 'viewer', manifest: m, tab: 'inference', canvas: 6 })).toBe(
      `/viewer?iiif-content=${enc}&tab=inference&canvas=6`,
    );
  });

  it('compare は見比べ方を載せる', () => {
    expect(hrefOf({ page: 'compare', manifest: m, mode: 'swipe' })).toBe(`/compare?iiif-content=${enc}&mode=swipe`);
  });

  it('kuniezu は、2 つのマニフェストを src= で並べて swipe で開く', () => {
    const u = USE_CASES.find((x) => x.id === 'kuniezu');
    expect(u?.features).toEqual(['image', 'compare']);
    const na = 'https://www.digital.archives.go.jp/api/iiif/764297/manifest.json';
    const su = 'https://purl.stanford.edu/hs631zg4177/iiif/manifest';
    expect(hrefOf(u!.open)).toBe(`/compare?src=${encodeURIComponent(na)}&src=${encodeURIComponent(su)}&mode=swipe`);
    expect(sourcesOf(u!.open)).toEqual([na, su]);
  });
});

describe('hrefOf（georef・search）', () => {
  it('georef は iiif-content だけを載せる', () => {
    expect(hrefOf({ page: 'georef', manifest: 'https://example.org/m.json' })).toBe(
      `/georef?iiif-content=${encodeURIComponent('https://example.org/m.json')}`,
    );
  });

  it('search は u に URL、q に検索語を載せる', () => {
    const u = 'https://example.org/c.json';
    expect(hrefOf({ page: 'search', url: u })).toBe(`/search?u=${encodeURIComponent(u)}`);
    expect(hrefOf({ page: 'search', url: u, query: '花 見' })).toBe(`/search?u=${encodeURIComponent(u)}&q=${encodeURIComponent('花 見')}`);
  });
});

describe('videoOf', () => {
  const base = USE_CASES[0];
  it('その言語の動画が無ければ、もう一方の言語の動画を出す', () => {
    const u = { ...base, video: { ja: 'aaaaaaaaaaa' } };
    expect(videoOf(u, 'en')).toBe('aaaaaaaaaaa');
    expect(videoOf({ ...base, video: undefined }, 'ja')).toBeUndefined();
  });
});

describe('usecaseById', () => {
  it('詳細ページの og:image になるサムネイルが日英とも public/ にある', () => {
    for (const u of USE_CASES) {
      for (const l of ['ja', 'en']) {
        expect(existsSync(join(__dirname, '../../public/thumbnails/usecases', `${u.id}.${l}.webp`)), `${u.id}.${l}`).toBe(true);
      }
    }
  });

  it('追加日は YYYY-MM-DD で、新しい順に並べられる', () => {
    for (const u of USE_CASES) expect(u.added, u.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const sorted = byNewest(USE_CASES);
    for (let i = 1; i < sorted.length; i++) expect(sorted[i - 1].added >= sorted[i].added).toBe(true);
  });

  it('id で引ける。無い id は undefined', () => {
    for (const u of USE_CASES) expect(usecaseById(u.id)).toBe(u);
    expect(usecaseById('no-such-id')).toBeUndefined();
  });
});
