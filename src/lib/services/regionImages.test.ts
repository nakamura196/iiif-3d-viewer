import { describe, expect, it } from 'vitest';
import plainSample from '../../../public/manifests/sample-manifest-with-annotations.json';
import { convertToV4 } from './manifestConverter';
import { parseManifestV4, geoAnnotations, defaultCameraOf, type GeoFeature } from './manifestParser';
import { thumbnailOf } from '@/components/annotation/AnnotationImages';

const load = (manifest: unknown) => parseManifestV4(convertToV4(manifest));

const scene = 'https://example.org/m#scene';
const manifestWith = (body: unknown) => ({
  '@context': 'http://iiif.io/api/presentation/4/context.json',
  id: 'https://example.org/m',
  type: 'Manifest',
  items: [{
    id: scene,
    type: 'Scene',
    items: [],
    annotations: [{
      id: 'https://example.org/m#page',
      type: 'AnnotationPage',
      items: [{
        id: 'https://example.org/m#a1',
        type: 'Annotation',
        motivation: ['commenting'],
        body,
        target: {
          type: 'SpecificResource',
          source: [{ id: scene, type: 'Scene' }],
          selector: [{ type: 'PointSelector', x: 1, y: 2, z: 3 }],
        },
      }],
    }],
  }],
});

describe('Image bodies (pictures of the annotated place)', () => {
  it('reads an Image body next to the description and a tag', () => {
    const [a] = load(manifestWith([
      { type: 'TextualBody', value: '<p>231 Powell St</p>', label: { ja: ['井手律事務所'] } },
      {
        id: 'https://example.org/iiif/photo1/full/max/0/default.jpg',
        type: 'Image',
        format: 'image/jpeg',
        label: { en: ['Powell Street, 1938'] },
        service: [{ id: 'https://example.org/iiif/photo1', type: 'ImageService3', profile: 'level1' }],
        homepage: [{ id: 'https://example.org/record/1', type: 'Text', format: 'text/html', label: { en: ['Record'] } }],
      },
      { type: 'TextualBody', purpose: 'tagging', value: '法律事務', label: { ja: ['業種'] } },
    ])).annotations;
    // the Image body is neither the description nor a tag
    expect(a.title).toBe('井手律事務所');
    expect(a.description).toBe('<p>231 Powell St</p>');
    expect(a.tags).toEqual([{ key: '業種', value: '法律事務' }]);
    expect(a.images).toEqual([{
      id: 'https://example.org/iiif/photo1/full/max/0/default.jpg',
      label: 'Powell Street, 1938',
      format: 'image/jpeg',
      service: 'https://example.org/iiif/photo1',
      homepage: 'https://example.org/record/1',
      homepageLabel: 'Record',
    }]);
    expect(thumbnailOf(a.images![0])).toBe('https://example.org/iiif/photo1/full/!240,240/0/default.jpg');
  });

  it('uses the image itself as the thumbnail when there is no image service', () => {
    const [a] = load(manifestWith([
      { type: 'TextualBody', value: '' , label: 'x' },
      { id: 'https://example.org/p.jpg', type: 'Image', format: 'image/jpeg' },
    ])).annotations;
    expect(thumbnailOf(a.images![0])).toBe('https://example.org/p.jpg');
  });

  it('does not take an Image body as the description even when it comes first', () => {
    const [a] = load(manifestWith([
      { id: 'https://example.org/p.jpg', type: 'Image' },
      { type: 'TextualBody', value: 'text', label: { none: ['label'] } },
    ])).annotations;
    expect(a.description).toBe('text');
    expect(a.images).toHaveLength(1);
  });

  it('keeps the W3C purpose: linking = a related resource, describing = the place', () => {
    const [a] = load(manifestWith([
      { type: 'TextualBody', value: 'text', label: { none: ['label'] } },
      { id: 'https://example.org/place.jpg', type: 'Image', purpose: 'describing' },
      { id: 'https://example.org/related.jpg', type: 'Image', purpose: ['linking'] },
      { id: 'https://example.org/plain.jpg', type: 'Image' },
    ])).annotations;
    expect(a.images?.map((i) => i.purpose)).toEqual(['describing', 'linking', undefined]);
  });

  it('leaves manifests without Image bodies unchanged', () => {
    for (const a of load(plainSample).annotations) expect(a.images).toBeUndefined();
  });
});

describe('geoAnnotations (georeferencing page)', () => {
  const feature = (id: string, depiction?: string): GeoFeature => ({
    '@id': id,
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [-123.1, 49.28] },
    properties: { title: id, resourceCoords: [1, 2, 3] },
    ...(depiction ? { depictions: [{ '@id': depiction }] } : {}),
  });

  it('takes the description, images and camera of the commenting annotation with the same key', () => {
    const [a] = load(manifestWith([
      { type: 'TextualBody', value: 'text', label: { none: ['label'] } },
      { id: 'https://example.org/p.jpg', type: 'Image' },
    ])).annotations; // id https://example.org/m#a1
    const [g] = geoAnnotations([feature('a1')], [a]);
    expect(g.id).toBe('a1'); // the map selects by the feature id
    expect(g.description).toBe('text');
    expect(g.images).toHaveLength(1);
  });

  it('falls back to the feature alone, with its depictions as images', () => {
    const [g] = geoAnnotations([feature('x', 'https://example.org/d.jpg')], []);
    expect(g.title).toBe('x');
    expect(g.images).toEqual([{ id: 'https://example.org/d.jpg' }]);
    expect(g.data.target.selector.camPos).toEqual([1.5, 3, 4.5]);
  });
});

describe('defaultCameraOf (Presentation 4.0 default Camera)', () => {
  const withCamera = (camera: Record<string, unknown>, extra: Record<string, unknown> = {}) => {
    const m = manifestWith([]) as any;
    m.items[0].items = [{ id: 'p', type: 'AnnotationPage', items: [{
      id: 'cam', type: 'Annotation', motivation: ['painting'], body: camera, ...extra,
      target: { type: 'SpecificResource', source: [{ id: scene, type: 'Scene' }], selector: [{ type: 'PointSelector', x: -800, y: 1000, z: 900 }] },
    }] }];
    return m;
  };

  it('reads the first Camera painted into the Scene, with lookAt and fieldOfView', () => {
    expect(defaultCameraOf(convertToV4(withCamera({ type: 'PerspectiveCamera', lookAt: { type: 'PointSelector', x: 70, y: 0, z: 60 }, fieldOfView: 50 }))))
      .toEqual({ position: [-800, 1000, 900], lookAt: [70, 0, 60], fieldOfView: 50 });
  });

  it('skips a hidden camera, and returns null when there is none', () => {
    expect(defaultCameraOf(convertToV4(withCamera({ type: 'PerspectiveCamera' }, { behavior: ['hidden'] })))).toBeNull();
    expect(defaultCameraOf(convertToV4(plainSample))).toBeNull();
  });
});
