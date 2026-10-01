import { describe, expect, it } from 'vitest';
import plainSample from '../../../public/manifests/sample-manifest-with-annotations.json';
import { convertToV4 } from './manifestConverter';
import { parseManifestV4 } from './manifestParser';
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

  it('leaves manifests without Image bodies unchanged', () => {
    for (const a of load(plainSample).annotations) expect(a.images).toBeUndefined();
  });
});
