import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { containersOf } from '../services/containers';
import { convertToV4 } from '../services/manifestConverter';
import { upgradeToV3 } from '../services/upgradeV2';
import {
  curationManifestUrls,
  curationMemberAt,
  curationSelectionsOf,
  curationToManifest,
  isCuration,
  languageMapOf,
  resolveCuration,
} from './curation';
import { navigableTree, rangesOf, startOf } from './structure';

// CODH の Curation API 1.0 のサンプル（IIIF Curation Viewer の sample/curation.json）と、
// そこから参照される 2 冊のマニフェスト。2026-10-13 に codh.rois.ac.jp から保存した。
// 1 つ目の selection は canvases（URL の一覧）、2 つ目は members（{@id, label}）で書かれている。
const fixture = (name: string) =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`../services/__fixtures__/${name}`, import.meta.url)), 'utf8'));
const curation = () => fixture('codh-curation.json');
const M1 = 'http://codh.rois.ac.jp/pmjt/book/200014778/manifest.json';
const M2 = 'http://codh.rois.ac.jp/pmjt/book/200003067/manifest.json';
const sources: Record<string, string> = {
  [M1]: 'codh-manifest-200014778.json',
  [M2]: 'codh-manifest-200003067.json',
};
const fetchJson = async (url: string) => (sources[url] ? fixture(sources[url]) : null);

describe('isCuration', () => {
  it('cr:Curation を見分ける', () => {
    expect(isCuration(curation())).toBe(true);
    expect(isCuration(fixture('codh-manifest-200014778.json'))).toBe(false);
    expect(isCuration(null)).toBe(false);
  });
});

describe('curationSelectionsOf', () => {
  it('canvases と members の両方の書き方を読む', () => {
    const s = curationSelectionsOf(curation());
    expect(s.map((x) => x.manifestUrl)).toEqual([M1, M2]);
    expect(s[0].members.map((m) => m.id)[3]).toBe('http://codh.rois.ac.jp/pmjt/iiif/200014778/canvas/00023#xywh=3435,2487,840,750');
    expect(s[0].members[3].canvasId).toBe('http://codh.rois.ac.jp/pmjt/iiif/200014778/canvas/00023');
    expect(s[1].members[1].label).toEqual({ none: ['p.9'] });
    expect(s[1].manifestLabel).toEqual({ none: ['唐糸草紙'] });
  });

  it('Timeline API の within（tl:Manifest）は読まない', () => {
    const c = {
      '@type': 'cr:Curation',
      selections: [{ members: [{ '@id': 'https://t/c1', cursorIndex: 1 }], within: { '@id': 'https://t/tl.json', '@type': 'tl:Manifest' } }],
    };
    expect(curationSelectionsOf(c)[0].readable).toBe(false);
    expect(curationManifestUrls(c)).toEqual([]);
  });
});

describe('languageMapOf', () => {
  it('Presentation 2 の label を 3 の形にする', () => {
    expect(languageMapOf('a')).toEqual({ none: ['a'] });
    expect(
      languageMapOf([
        { '@value': 'ひまわり', '@language': 'ja' },
        { '@value': 'Himawari', '@language': 'en' },
      ]),
    ).toEqual({ ja: ['ひまわり'], en: ['Himawari'] });
    expect(languageMapOf(undefined)).toBeUndefined();
  });
});

describe('resolveCuration', () => {
  it('2 冊から使われている Canvas だけを、1 回ずつ並べる', async () => {
    const m = (await resolveCuration(curation(), fetchJson)) as { items: { id: string; partOf: { id: string }[] }[] };
    expect(m.items.map((c) => c.id.split('/').slice(-3).join('/'))).toEqual([
      '200014778/canvas/00000',
      '200014778/canvas/00011',
      '200014778/canvas/00023',
      '200003067/canvas/00000',
      '200003067/canvas/00008',
      '200003067/canvas/00010',
    ]);
    // どの資料から来たか
    expect(m.items[0].partOf.at(-1)?.id).toBe(M1);
    expect(m.items[5].partOf.at(-1)?.id).toBe(M2);
  });

  it('順番と領域は目次に残り、ビューアの目次として読める', async () => {
    const m = convertToV4(await resolveCuration(curation(), fetchJson));
    const toc = navigableTree(rangesOf(m));
    expect(toc).toHaveLength(2);
    expect(toc[0].label).toEqual({ none: ['Curated contents from 『画本虫撰』'] });
    expect(toc[0].children).toHaveLength(4);
    expect(toc[0].children[3].target?.xywh).toEqual([3435, 2487, 840, 750]);
    expect(toc[1].children[1].label).toEqual({ none: ['p.9'] });
  });

  it('start は 1 番目、pos で何番目からかを変えられる', async () => {
    const m = convertToV4(await resolveCuration(curation(), fetchJson));
    const containers = containersOf(m);
    expect(startOf(m, containers)?.index).toBe(0);
    const t = curationMemberAt(m, 8);
    expect(t).toEqual({ canvasId: 'http://codh.rois.ac.jp/pmjt/iiif/200003067/canvas/00010', xywh: [2850, 1000, 730, 680] });
    expect(curationMemberAt(m, 9)).toBeNull();
    // キュレーションでないマニフェストには効かない
    expect(curationMemberAt(fixture('codh-manifest-200014778.json'), 1)).toBeNull();
  });

  it('読めなかったマニフェストの分は飛ばし、1 つも読めなければ null', async () => {
    const onlyFirst = async (url: string) => (url === M1 ? fixture(sources[M1]) : null);
    const m = (await resolveCuration(curation(), onlyFirst)) as { items: unknown[]; structures: unknown[] };
    expect(m.items).toHaveLength(3);
    expect(m.structures).toHaveLength(1);
    expect(await resolveCuration(curation(), async () => null)).toBeNull();
  });

  it('attribution と related を、requiredStatement と homepage にする', () => {
    const m = curationToManifest(curation(), new Map([[M1, upgradeToV3(fixture(sources[M1]))]])) as Record<string, unknown>;
    expect(m.requiredStatement).toEqual({
      label: { none: ['Attribution'] },
      value: { none: ['Provided by CODH (ROIS) and NIJL NW Project.'] },
    });
    expect((m.homepage as { id: string }[])[0].id).toBe('http://example.org/iiif/curation/sample.html');
  });
});
