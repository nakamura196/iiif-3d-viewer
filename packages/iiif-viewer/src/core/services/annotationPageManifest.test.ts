import { describe, expect, it } from 'vitest';
import { isAnnotationPageJson, manifestFromAnnotationPage } from './annotationPageManifest';
import { convertToV4 } from './manifestConverter';
import { geoCanvasesOf, parseManifestV4 } from './manifestParser';

type Json = Record<string, unknown>;

const URL = 'https://annotations.allmaps.org/manifests/f2aa771c7d0ae1e8';

const point = (x: number, y: number, lng: number, lat: number) => ({
  type: 'Feature',
  properties: { resourceCoords: [x, y] },
  geometry: { type: 'Point', coordinates: [lng, lat] },
});

const georef = (id: string, source: Json, features: unknown[]) => ({
  id,
  type: 'Annotation',
  motivation: 'georeferencing',
  target: { type: 'SpecificResource', source, selector: { type: 'SvgSelector', value: '<svg/>' } },
  body: { type: 'FeatureCollection', features },
});

// annotations.allmaps.org の AnnotationPage を縮めたもの（画像 2 枚、1 枚目に注釈が 2 つ）
const kaart = {
  id: 'https://cdm21033.contentdm.oclc.org/iiif/2/krt:2164',
  type: 'ImageService2',
  width: 2867,
  height: 2832,
  partOf: [
    {
      id: 'https://cdm21033.contentdm.oclc.org/iiif/krt:2164/canvas/c0',
      type: 'Canvas',
      label: { none: ['[Indexkaart]'] },
      partOf: [{ id: 'https://cdm21033.contentdm.oclc.org/iiif/krt:2175/manifest.json', type: 'Manifest', label: { none: ['Choro-topographische kaart'] } }],
    },
  ],
};
const v3image = { id: 'https://example.org/iiif/3/sheet2/', type: 'ImageService3', width: 4000, height: 3000 };
const page = {
  '@context': 'http://iiif.io/api/extension/georef/1/context.json',
  type: 'AnnotationPage',
  items: [
    georef('https://annotations.allmaps.org/maps/a', kaart, [point(1977, 1986, 5.1, 52.1), point(100, 200, 5.0, 52.0)]),
    georef('https://annotations.allmaps.org/maps/b', v3image, [point(10, 20, 6.0, 53.0)]),
    georef('https://annotations.allmaps.org/maps/c', kaart, [point(500, 600, 5.2, 52.2)]),
    // Canvas の URI だけを指す注釈は、画像が分からないので読まない
    { ...georef('https://example.org/d', {}, [point(1, 1, 0, 0)]), target: 'https://example.org/canvas/1' },
  ],
};

// geo.ldas.jp が読んでいた形（target.source に画像のサービス、partOf なし）
const geoPage = {
  id: 'https://example.org/annotationPage.json',
  type: 'AnnotationPage',
  label: { ja: ['鳥瞰圖'] },
  items: [georef('https://example.org/anno', { id: 'https://example.org/iiif/2/map', type: 'ImageService2', width: 18415, height: 12911 }, [point(1000, 2000, 139.76, 35.71)])],
};

describe('manifestFromAnnotationPage', () => {
  it('detects only an AnnotationPage', () => {
    expect(isAnnotationPageJson(page)).toBe(true);
    expect(isAnnotationPageJson({ type: 'Canvas', items: [] })).toBe(false);
    expect(manifestFromAnnotationPage({ type: 'Manifest', items: [] }, URL)).toBeNull();
  });

  it('gives up when no annotation names an image service', () => {
    expect(manifestFromAnnotationPage({ type: 'AnnotationPage', items: [page.items[3]] }, URL)).toBeNull();
  });

  it('makes one Canvas per image, keeping the original Canvas id and label', () => {
    const m = manifestFromAnnotationPage(page, URL) as Json;
    const items = m.items as Json[];
    expect(m.type).toBe('Manifest');
    expect(m.id).toBe(URL);
    expect(m['@context']).toBe(page['@context']);
    expect(m.label).toEqual({ none: ['Choro-topographische kaart'] });
    expect(items.map((c) => c.id)).toEqual([kaart.partOf[0].id, `${URL}#canvas-2`]);
    expect(items[0].label).toEqual({ none: ['[Indexkaart]'] });
    expect(items[0].width).toBe(2867);
    const annotations = items[0].annotations as Json[];
    expect((annotations[0].items as Json[]).map((a) => a.id)).toEqual([
      'https://annotations.allmaps.org/maps/a',
      'https://annotations.allmaps.org/maps/c',
    ]);
  });

  it('paints the image through its service (v2 and v3)', () => {
    const items = (manifestFromAnnotationPage(page, URL) as Json).items as Json[];
    const bodyOf = (c: Json) => (((c.items as Json[])[0].items as Json[])[0].body as Json);
    expect(bodyOf(items[0]).id).toBe('https://cdm21033.contentdm.oclc.org/iiif/2/krt:2164/full/full/0/default.jpg');
    expect(bodyOf(items[1]).id).toBe('https://example.org/iiif/3/sheet2/full/max/0/default.jpg');
    expect((bodyOf(items[1]).service as Json[])[0]).toMatchObject({ id: 'https://example.org/iiif/3/sheet2', type: 'ImageService3' });
  });

  it('keeps the georeferenced points readable', () => {
    const v4 = convertToV4(manifestFromAnnotationPage(page, URL));
    const canvases = geoCanvasesOf(v4);
    expect(canvases.map((c) => c.features.length)).toEqual([3, 1]);
    expect(parseManifestV4(v4).geoCanvasId).toBe(kaart.partOf[0].id);
  });

  it('reads the shape geo.ldas.jp read, named by the page label', () => {
    const m = manifestFromAnnotationPage(geoPage, 'https://example.org/annotationPage.json') as Json;
    expect(m.label).toEqual({ ja: ['鳥瞰圖'] });
    const canvas = (m.items as Json[])[0];
    expect((canvas.annotations as Json[])[0].id).toBe(geoPage.id);
    expect(parseManifestV4(convertToV4(m)).geoFeatures).toHaveLength(1);
  });
});
