import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { containersOf } from '../services/containers';
import { convertToV4 } from '../services/manifestConverter';
import {
  canvasBehaviorsOf,
  collectionEntriesOf,
  contentStateOf,
  groupSpreads,
  hasToc,
  matchTarget,
  navigableTree,
  orderOf,
  parseContentState,
  parseDroppedText,
  parseFragment,
  rangesOf,
  sequencesOf,
  splitId,
  startOf,
  pageThumbnailUrl,
  viewingOf,
} from './structure';

// Cookbook の v3 レシピ（iiif.io から 2026-10-12 に保存）
const raw = (n: string): Record<string, unknown> =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`./__fixtures__/structure/${n}.json`, import.meta.url)), 'utf8'));
const load = (n: string) => {
  const manifest = convertToV4(raw(n));
  return { manifest, containers: containersOf(manifest) };
};
const toBase64Url = (s: string) =>
  Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

describe('断片', () => {
  it('xywh と t を読む', () => {
    expect(parseFragment('xywh=1,2,3,4')).toEqual({ xywh: [1, 2, 3, 4] });
    expect(parseFragment('#t=302.05,3971.24')).toEqual({ t: [302.05, 3971.24] });
    expect(parseFragment('t=3971.24')).toEqual({ t: [3971.24, undefined] });
    expect(parseFragment('xywh=a,b')).toEqual({});
  });
  it('id から断片を分ける', () => {
    expect(splitId('https://x/canvas/1#t=0,9')).toEqual({ id: 'https://x/canvas/1', fragment: { t: [0, 9] } });
  });
});

describe('見せ方 0009・0010・0011', () => {
  it('0009 behavior: paged、左から右', () => {
    expect(viewingOf(raw('0009'))).toMatchObject({ mode: 'paged', direction: 'left-to-right' });
  });
  it('0010 viewingDirection: right-to-left', () => {
    expect(viewingOf(raw('0010'))).toMatchObject({ mode: 'individuals', direction: 'right-to-left' });
  });
  it('0011 behavior: continuous', () => {
    expect(viewingOf(raw('0011')).mode).toBe('continuous');
  });
  it('既定は individuals', () => {
    expect(viewingOf({})).toMatchObject({ mode: 'individuals', direction: 'left-to-right' });
  });
  it('paged の見開き: 先頭は単独、あとは 2 枚ずつ', () => {
    expect(groupSpreads([0, 1, 2, 3, 4], 'paged', () => false)).toEqual([[0], [1, 2], [3, 4]]);
    expect(groupSpreads([0, 1, 2, 3, 4], 'paged', (i) => i === 2)).toEqual([[0], [1], [2], [3, 4]]);
    expect(groupSpreads([0, 1, 2], 'individuals', () => false)).toEqual([[0], [1], [2]]);
  });
  it('Canvas ごとの behavior', () => {
    const m = { items: [{ id: 'a', behavior: ['non-paged'] }, { id: 'b' }] };
    expect(canvasBehaviorsOf(m).get('a')).toEqual(['non-paged']);
    expect(canvasBehaviorsOf(m).get('b')).toEqual([]);
  });
});

describe('start 0015・0202', () => {
  it('0202 start が Canvas（p2）を指す', () => {
    const { manifest, containers } = load('0202');
    const s = startOf(manifest, containers);
    expect(s?.canvasId).toMatch(/canvas\/p2$/);
    expect(s?.index).toBe(1);
  });
  it('0015 start が SpecificResource（PointSelector の t=120.5）', () => {
    const { manifest, containers } = load('0015');
    const s = startOf(manifest, containers);
    expect(s).toMatchObject({ index: 0, t: [120.5, undefined] });
  });
  it('start が無ければ null', () => {
    const { manifest, containers } = load('0009');
    expect(startOf(manifest, containers)).toBeNull();
  });
});

describe('目次 0024・0025・0026・0027・0031・0064・0065・0229', () => {
  it('0024 Range の入れ子（目次 > 章 > 曜日）', () => {
    const [root] = rangesOf(raw('0024'));
    expect(root.children).toHaveLength(2);
    const [r1, r2] = root.children;
    expect(r1.canvases.map((c) => c.canvasId.split('/').pop())).toEqual(['p1', 'p2']);
    expect(r1.target?.canvasId).toMatch(/p1$/);
    expect(r2.children).toHaveLength(2);
    expect(r2.target?.canvasId).toMatch(/p3$/);
  });
  it('0025 SpecificResource の領域（xywh）へ飛ぶ', () => {
    const [root] = rangesOf(raw('0025'));
    const article = root.children[0];
    expect(article.canvases).toHaveLength(4);
    expect(article.target).toMatchObject({ canvasId: expect.stringMatching(/canvas\/p2$/), xywh: [553, 1157, 470, 1103] });
  });
  it('0026・0064 Canvas の時間の範囲（#t=）', () => {
    const [root] = rangesOf(raw('0064'));
    const act1 = root.children[0];
    const first = act1.children[0];
    expect(first.target).toMatchObject({ canvasId: expect.stringMatching(/canvas\/1$/), t: [0, 302.05] });
    expect(rangesOf(raw('0026'))[0].children[1].target?.t).toEqual([3971.24, undefined]);
  });
  it('0065 複数の Canvas にまたがる', () => {
    const [root] = rangesOf(raw('0065'));
    expect(root.children[1].target?.canvasId).toMatch(/canvas\/2$/);
    expect(root.children[1].target?.t).toEqual([0, 3307.22]);
  });
  it('0031 製本された複数巻', () => {
    const [root] = rangesOf(raw('0031'));
    expect(root.children.length).toBeGreaterThanOrEqual(3);
  });
  it('0229 no-nav は出さず、thumbnail-nav の Range に縮小画像がある', () => {
    const tree = rangesOf(raw('0229'));
    expect(tree[0].behavior).toContain('thumbnail-nav');
    expect(tree[0].children[0].noNav).toBe(true);
    const nav = navigableTree(tree);
    expect(nav[0].children.some((c) => c.noNav)).toBe(false);
    expect(nav[0].children[0].thumbnail).toMatch(/thumb-nav-01\.png$/);
    expect(hasToc(raw('0229'))).toBe(true);
  });
  it('0027 代替のページ順（sequence）', () => {
    const m = raw('0027');
    expect(rangesOf(m)).toEqual([]);
    expect(hasToc(m)).toBe(false);
    const seqs = sequencesOf(m);
    expect(seqs).toHaveLength(2);
    const { containers } = load('0027');
    expect(orderOf(containers, null)).toEqual([0, 1, 2, 3]);
    expect(orderOf(containers, seqs[1])).toEqual([1, 2, 3, 0]);
  });
  it('構造の無いマニフェストでは空', () => {
    expect(rangesOf(raw('0009'))).toEqual([]);
    expect(sequencesOf(raw('0009'))).toEqual([]);
  });
});

describe('content state 0485・0540・0599', () => {
  it('0485 Canvas の領域を指す Annotation（JSON）', () => {
    const state = contentStateOf(raw('0485'));
    expect(state?.manifestUrl).toBe('https://iiif.io/api/cookbook/recipe/0009-book-1/manifest.json');
    expect(state?.targets).toEqual([
      {
        canvasId: 'https://iiif.io/api/cookbook/recipe/0009-book-1/canvas/p2',
        xywh: [1528, 3024, 344, 408],
        manifestUrl: 'https://iiif.io/api/cookbook/recipe/0009-book-1/manifest.json',
      },
    ]);
    const { containers } = load('0009');
    expect(matchTarget(state!.targets, containers)).toMatchObject({ index: 1, xywh: [1528, 3024, 344, 408] });
  });
  it('base64url（URL エンコードした JSON）も、素の JSON も読める', () => {
    const json = JSON.stringify(raw('0485'));
    const viaUri = toBase64Url(encodeURIComponent(json));
    const plain = toBase64Url(json);
    expect(parseContentState(viaUri)?.targets[0].xywh).toEqual([1528, 3024, 344, 408]);
    expect(parseContentState(plain)?.targets[0].xywh).toEqual([1528, 3024, 344, 408]);
    expect(parseContentState(encodeURIComponent(json))?.targets).toHaveLength(1);
  });
  it('0540 複数の Canvas（別々の Manifest）を指す', () => {
    const state = contentStateOf({
      type: 'Annotation',
      motivation: ['contentState'],
      target: [
        { id: 'https://ex.org/a/canvas/2', type: 'Canvas', partOf: [{ id: 'https://ex.org/a/manifest.json', type: 'Manifest' }] },
        { id: 'https://ex.org/b/canvas/p2', type: 'Canvas', partOf: [{ id: 'https://ex.org/b/manifest.json', type: 'Manifest' }] },
      ],
    });
    expect(state?.manifestUrl).toBe('https://ex.org/a/manifest.json');
    expect(state?.targets.map((t) => t.manifestUrl)).toEqual([
      'https://ex.org/a/manifest.json',
      'https://ex.org/b/manifest.json',
    ]);
  });
  it('0599 マニフェストを指す Annotation（ドロップ）', () => {
    const state = contentStateOf(raw('0599'));
    expect(state).toEqual({
      manifestUrl: 'https://iiif.io/api/cookbook/recipe/0006-text-language/manifest.json',
      targets: [],
    });
    const dropped = parseDroppedText('https://viewer.example/?iiif-content=' + encodeURIComponent('https://ex.org/m.json'));
    expect(dropped?.manifestUrl).toBe('https://ex.org/m.json');
    expect(parseDroppedText('https://ex.org/m.json')?.manifestUrl).toBe('https://ex.org/m.json');
  });
  it('SpecificResource の source と FragmentSelector', () => {
    const state = contentStateOf({
      type: 'Annotation',
      target: {
        type: 'SpecificResource',
        source: { id: 'https://ex.org/c/1', type: 'Canvas', partOf: [{ id: 'https://ex.org/m', type: 'Manifest' }] },
        selector: { type: 'FragmentSelector', value: 'xywh=10,20,30,40' },
      },
    });
    expect(state?.targets[0]).toMatchObject({ canvasId: 'https://ex.org/c/1', xywh: [10, 20, 30, 40] });
    expect(state?.manifestUrl).toBe('https://ex.org/m');
  });
  it('読めない値は null', () => {
    expect(parseContentState('!!!')).toBeNull();
    expect(parseContentState(null)).toBeNull();
  });
});

describe('Collection 0030・0032・0068', () => {
  it('0032 項目はマニフェスト 2 件', () => {
    const entries = collectionEntriesOf(raw('0032'));
    expect(entries.map((e) => e.type)).toEqual(['Manifest', 'Manifest']);
    expect(entries[0].id).toMatch(/manifest-01\.json$/);
  });
  it('0068 入れ子の Collection も拾う', () => {
    const entries = collectionEntriesOf(raw('0068'));
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every((e) => e.id.startsWith('https://'))).toBe(true);
  });
  it('0030 複数巻', () => {
    expect(collectionEntriesOf(raw('0030')).length).toBeGreaterThanOrEqual(2);
  });
});

describe('0464 他のマニフェストの Canvas を再利用', () => {
  it('Canvas の id が元のレシピのもの', () => {
    const { containers } = load('0464');
    expect(containers[0].id).toMatch(/0008-rights\/canvas\/p1$/);
  });
});

describe('サムネイル', () => {
  it('IIIF Image API の URL を小さくする', () => {
    const { containers } = load('0009');
    const url = pageThumbnailUrl(containers[0]);
    expect(url).toBeDefined();
  });
  it('Canvas の thumbnail を優先する', () => {
    const { containers } = load('0009');
    expect(pageThumbnailUrl(containers[0], { thumbnail: [{ id: 'https://ex.org/t.jpg' }] })).toBe('https://ex.org/t.jpg');
  });
});
