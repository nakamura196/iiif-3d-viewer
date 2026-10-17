import { describe, expect, it } from 'vitest';
import { canOpenInGallery, galleryQuery } from './gallery';

describe('canOpenInGallery', () => {
  it('accepts a v3 manifest with an image', () => {
    const m = {
      type: 'Manifest',
      items: [{ type: 'Canvas', items: [{ type: 'AnnotationPage', items: [{ type: 'Annotation', body: { type: 'Image', id: 'x.jpg' } }] }] }],
    };
    expect(canOpenInGallery(m)).toBe(true);
  });

  it('accepts a v2 manifest with an image', () => {
    const m = {
      '@type': 'sc:Manifest',
      sequences: [{ canvases: [{ images: [{ resource: { '@type': 'dctypes:Image', '@id': 'x.jpg' } }] }] }],
    };
    expect(canOpenInGallery(m)).toBe(true);
  });

  it('accepts collections and curations', () => {
    expect(canOpenInGallery({ type: 'Collection', items: [] })).toBe(true);
    expect(canOpenInGallery({ '@type': 'sc:Collection' })).toBe(true);
    expect(canOpenInGallery({ '@type': 'cr:Curation', selections: [] })).toBe(true);
  });

  it('rejects a 3D-only manifest', () => {
    const m = {
      type: 'Manifest',
      items: [{ type: 'Scene', items: [{ type: 'AnnotationPage', items: [{ type: 'Annotation', body: { type: 'Model', id: 'x.glb' } }] }] }],
    };
    expect(canOpenInGallery(m)).toBe(false);
  });

  it('rejects non-objects', () => {
    expect(canOpenInGallery(null)).toBe(false);
    expect(canOpenInGallery('x')).toBe(false);
  });
});

describe('galleryQuery', () => {
  const url = 'https://example.org/manifest.json';

  it('writes only the URL when every option is the default', () => {
    expect(galleryQuery(url)).toBe(`u=${encodeURIComponent(url)}`);
    expect(galleryQuery(url, { mode: 'orbit', quality: 'auto', look: 'standard' })).toBe(`u=${encodeURIComponent(url)}`);
  });

  it('writes the chosen mode, quality, interior and number of works', () => {
    const q = new URLSearchParams(galleryQuery(url, { mode: 'walk', quality: 'low', look: 'museum', limit: 48 }));
    expect(q.get('u')).toBe(url);
    expect(q.get('mode')).toBe('walk');
    expect(q.get('quality')).toBe('low');
    expect(q.get('look')).toBe('museum');
    expect(q.get('limit')).toBe('48');
  });

  it('asks for the third-person walk explicitly', () => {
    expect(new URLSearchParams(galleryQuery(url, { mode: 'thirdperson' })).get('mode')).toBe('thirdperson');
  });
});
