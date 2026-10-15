import { describe, expect, it } from 'vitest';
import {
  candidatesOfManifest,
  compareDetailWidthOf,
  fitSide,
  infoCandidateOf,
  isCollectionJson,
  isImageInfoJson,
  memberManifestUrlsOf,
  type CompareSide,
} from './compareSources';

const canvas = (id: string, w: number, h: number, label: string) => ({
  id,
  type: 'Canvas',
  label: { none: [label] },
  width: w,
  height: h,
  items: [
    {
      type: 'AnnotationPage',
      items: [
        {
          type: 'Annotation',
          motivation: 'painting',
          body: {
            id: `${id}/full/max/0/default.jpg`,
            type: 'Image',
            width: w,
            height: h,
            service: [{ id: `${id}-img`, type: 'ImageService3' }],
          },
          target: id,
        },
      ],
    },
  ],
});

describe('compareSources', () => {
  it('info.json を見分ける', () => {
    expect(isImageInfoJson({ '@context': 'http://iiif.io/api/image/2/context.json', '@id': 'u', width: 1, height: 1 })).toBe(true);
    expect(isImageInfoJson({ protocol: 'http://iiif.io/api/image', width: 1, height: 1 })).toBe(true);
    expect(isImageInfoJson({ type: 'Manifest', '@context': 'http://iiif.io/api/presentation/3/context.json' })).toBe(false);
    expect(isImageInfoJson({ '@type': 'sc:Manifest' })).toBe(false);
  });

  it('info.json から 1 枚の候補を作る（名前は info.json の前の部分）', () => {
    const c = infoCandidateOf(
      { '@context': 'http://iiif.io/api/image/2/context.json', '@id': 'https://e.org/iiif/map.jp2', width: 400, height: 300 },
      'https://e.org/iiif/map.jp2/info.json',
    );
    expect(c?.label).toBe('map.jp2');
    expect(c?.side).toMatchObject({ width: 400, height: 300 });
    expect(c?.side.layers[0].service).toEqual({ id: 'https://e.org/iiif/map.jp2', version: 2 });
  });

  it('Manifest: Canvas が 1 つなら Manifest の名前、複数なら「Manifest — Canvas」', () => {
    const one = { type: 'Manifest', label: { ja: ['地図'] }, items: [canvas('c1', 100, 50, 'p1')] };
    expect(candidatesOfManifest(one, 'ja').map((c) => c.label)).toEqual(['地図']);
    const two = { ...one, items: [canvas('c1', 100, 50, 'p1'), canvas('c2', 80, 80, 'p2')] };
    const out = candidatesOfManifest(two, 'ja');
    expect(out.map((c) => c.label)).toEqual(['地図 — p1', '地図 — p2']);
    expect(out[1].side).toMatchObject({ width: 80, height: 80 });
  });

  it('Collection の Manifest だけを拾う', () => {
    const col = { type: 'Collection', items: [{ id: 'm1', type: 'Manifest' }, { id: 'c', type: 'Collection' }, { id: 'm2', type: 'Manifest' }] };
    expect(isCollectionJson(col)).toBe(true);
    expect(memberManifestUrlsOf(col)).toEqual(['m1', 'm2']);
  });

  it('fitSide: A の枠に縦横比を保って収め、中央に置く', () => {
    const layer = { url: 'u', rotation: 0, mirror: false, annotations: [] };
    const b: CompareSide = { layers: [layer], width: 100, height: 100 };
    const fitted = fitSide(b, { width: 400, height: 200 });
    expect(fitted).toMatchObject({ width: 400, height: 200 });
    expect(fitted.layers[0].target).toEqual({ x: 100, y: 0, w: 200, h: 200 });
    // 同じ大きさなら、そのまま
    expect(fitSide(b, { width: 100, height: 100 })).toBe(b);
  });

  it('compareDetailWidthOf: B の細かさを A の枠の幅に直して比べる', () => {
    const layer = { url: 'u', rotation: 0, mirror: false, annotations: [] };
    const a: CompareSide = { layers: [{ ...layer, width: 1000 }], width: 400, height: 200 };
    const b = fitSide({ layers: [{ ...layer, width: 5000 }], width: 100, height: 100 }, a);
    // B は枠の幅 400 のうち 200 を使う → 5000 px が 200 に入る → 枠の幅では 10000
    expect(compareDetailWidthOf(a, b)).toBe(10000);
  });
});
