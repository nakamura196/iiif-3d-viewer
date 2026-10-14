import { describe, expect, it } from 'vitest';
import { convertToV4 } from './manifestConverter';
import { geoAnnotations, geoFeatureIdOf, parseManifestV4 } from './manifestParser';

// 画像（Canvas）に付いたジオリファレンス。geo.ldas.jp/manifest.json と同じ形（地点 2 件に縮めたもの）。
const feature = (n: number, xy: [number, number], lnglat: [number, number]) => ({
  type: 'Feature',
  id: `gcp-${n}`,
  '@id': `https://example.org/places/gcp-${n}`,
  properties: { resourceCoords: xy, title: `GCP ${n}` },
  geometry: { type: 'Point', coordinates: lnglat },
});

const imageManifest = {
  '@context': ['http://iiif.io/api/extension/georef/1/context.json', 'http://iiif.io/api/presentation/3/context.json'],
  id: 'https://example.org/iiif/manifest',
  type: 'Manifest',
  label: { ja: ['絵図'] },
  items: [
    {
      id: 'https://example.org/iiif/canvas/1',
      type: 'Canvas',
      width: 18415,
      height: 12911,
      items: [
        {
          id: 'https://example.org/iiif/canvas/1/page',
          type: 'AnnotationPage',
          items: [
            {
              id: 'https://example.org/iiif/canvas/1/page/1',
              type: 'Annotation',
              motivation: 'painting',
              body: { id: 'https://example.org/iiif/image/full/max/0/default.jpg', type: 'Image', width: 18415, height: 12911 },
              target: 'https://example.org/iiif/canvas/1',
            },
          ],
        },
      ],
      annotations: [
        {
          id: 'https://example.org/iiif/canvas/1/georef',
          type: 'AnnotationPage',
          items: [
            {
              id: 'https://example.org/iiif/canvas/1/georef/1',
              type: 'Annotation',
              motivation: 'georeferencing',
              target: 'https://example.org/iiif/canvas/1',
              body: {
                type: 'FeatureCollection',
                transformation: { type: 'polynomial', options: { order: 1 } },
                features: [feature(1, [6690, 7517], [139.7623182, 35.7151233]), feature(2, [100, 200], [139.75, 35.7])],
              },
            },
          ],
        },
      ],
    },
  ],
};

describe('georeferencing on a Canvas (a georeferenced picture)', () => {
  const parsed = parseManifestV4(convertToV4(imageManifest));

  it('reads the places of the Canvas and names the Canvas', () => {
    expect(parsed.modelUrl).toBeNull();
    expect(parsed.geoCanvasId).toBe('https://example.org/iiif/canvas/1');
    expect(parsed.geoFeatures.map((f) => f.properties.title)).toEqual(['GCP 1', 'GCP 2']);
    expect(parsed.geoFeatures[0].properties.resourceCoords).toEqual([6690, 7517]);
  });

  it('builds one annotation per place, keyed as the map keys it, with z = 0', () => {
    const annos = geoAnnotations(parsed.geoFeatures, parsed.annotations);
    expect(annos.map((a) => a.id)).toEqual(parsed.geoFeatures.map(geoFeatureIdOf));
    expect(annos[0].position).toEqual({ x: 6690, y: 7517, z: 0 });
  });

  it('falls back to the GeoJSON id, then to the index', () => {
    const f = parsed.geoFeatures[0];
    expect(geoFeatureIdOf({ ...f, '@id': '' }, 0)).toBe('gcp-1');
    expect(geoFeatureIdOf({ ...f, '@id': '', id: undefined }, 4)).toBe('geo-feature-4');
  });
});
