import { describe, expect, it } from 'vitest';
import { isCanvasJson, manifestFromCanvas } from './canvasManifest';
import { convertToV4 } from './manifestConverter';
import { parseManifestV4 } from './manifestParser';

type Json = Record<string, unknown>;

const URL = 'https://geo.ldas.jp/canvas.json';
// geo.ldas.jp の canvas.json を縮めたもの（Georeference 拡張の地点が 2 つ）
const canvas = {
  '@context': ['http://iiif.io/api/extension/georef/1/context.json', 'http://iiif.io/api/presentation/3/context.json'],
  id: 'http://www.example.org/georeferenced-canvas.json',
  type: 'Canvas',
  label: { ja: ['鳥瞰圖'] },
  width: 18415,
  height: 12911,
  items: [
    {
      id: 'http://www.example.org/contentPage.json',
      type: 'AnnotationPage',
      items: [
        {
          id: 'http://www.example.org/content.json',
          type: 'Annotation',
          motivation: 'painting',
          body: {
            id: 'https://example.org/iiif/2/map/full/full/0/default.jpg',
            type: 'Image',
            format: 'image/jpeg',
            width: 18415,
            height: 12911,
            service: [{ id: 'https://example.org/iiif/2/map', type: 'ImageService2' }],
          },
          target: 'http://www.example.org/georeferenced-canvas.json',
        },
      ],
    },
  ],
  annotations: [
    {
      id: 'http://www.example.org/annotationPage.json',
      type: 'AnnotationPage',
      items: [
        {
          id: 'http://www.example.org/canvas-annotation.json',
          type: 'Annotation',
          motivation: 'georeferencing',
          target: 'http://www.example.org/georeferenced-canvas.json',
          body: {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                properties: { resourceCoords: [1000, 2000] },
                geometry: { type: 'Point', coordinates: [139.76, 35.71] },
              },
              {
                type: 'Feature',
                properties: { resourceCoords: [5000, 3000] },
                geometry: { type: 'Point', coordinates: [139.77, 35.72] },
              },
            ],
          },
        },
      ],
    },
  ],
};

describe('manifestFromCanvas', () => {
  it('detects only a Canvas', () => {
    expect(isCanvasJson(canvas)).toBe(true);
    expect(isCanvasJson({ type: 'Manifest', items: [] })).toBe(false);
    expect(manifestFromCanvas({ type: 'Manifest' }, URL)).toBeNull();
  });

  it('wraps the Canvas as the only item of a Manifest', () => {
    const m = manifestFromCanvas(canvas, URL) as Json;
    const items = m.items as Json[];
    expect(m.type).toBe('Manifest');
    expect(m.id).toBe(URL);
    expect(m.label).toEqual({ ja: ['鳥瞰圖'] });
    expect(m['@context']).toEqual(canvas['@context']);
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe(canvas.id);
    expect(items[0]['@context']).toBeUndefined();
  });

  it('keeps the georeferenced points readable', () => {
    const parsed = parseManifestV4(convertToV4(manifestFromCanvas(canvas, URL)));
    expect(parsed.geoCanvasId).toBe(canvas.id);
    expect(parsed.geoFeatures).toHaveLength(2);
  });
});
