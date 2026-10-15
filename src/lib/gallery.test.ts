import { describe, expect, it } from 'vitest';
import { canOpenInGallery } from './gallery';

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
