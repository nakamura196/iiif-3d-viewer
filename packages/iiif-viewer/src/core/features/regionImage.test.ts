import { describe, expect, it } from 'vitest';
import imageSample from '../../../../../public/manifests/sample-manifest-region-tags-image.json';
import { groupByRegion } from '../regions';
import { readCanvasAnnotations } from './annotations';

const canvas = imageSample.items[0];
const read = () =>
  readCanvasAnnotations(canvas.id, canvas.annotations, { width: canvas.width, height: canvas.height });

describe('Shared Region on a Canvas (2D)', () => {
  it('reads the region id of the target Specific Resource', () => {
    const annotations = read();
    expect(annotations).toHaveLength(6);
    expect(annotations.every((a) => a.regionId)).toBe(true);
  });

  it('groups annotations that share a region into one box, in document order', () => {
    const groups = groupByRegion(read());
    expect(groups.map((g) => g.annotations.length)).toEqual([3, 2, 1]);
    expect(groups[0].annotations.map((a) => a.id.split('#')[1])).toEqual(['anno-a-1', 'anno-a-2', 'anno-a-3']);
    // the first annotation supplies the geometry
    expect(groups[0].annotations[0].region).toEqual({ type: 'rect', x: 6200, y: 4300, w: 3200, h: 2300 });
  });

  it('keeps annotations of different regions apart even when their boxes are equal', () => {
    const page = (id: string, rid: string) => ({
      id,
      type: 'Annotation',
      motivation: 'commenting',
      body: { type: 'TextualBody', value: id },
      target: { id: rid, type: 'SpecificResource', source: 'https://example.org/c1', selector: [{ type: 'FragmentSelector', value: 'xywh=0,0,10,10' }] },
    });
    const annotations = readCanvasAnnotations('https://example.org/c1', [
      { type: 'AnnotationPage', items: [page('a', 'https://example.org/r1'), page('b', 'https://example.org/r2')] },
    ]);
    expect(groupByRegion(annotations)).toHaveLength(2);
  });
});

describe('Canvas annotations without the extension', () => {
  const plain = readCanvasAnnotations('https://example.org/c1', [
    {
      type: 'AnnotationPage',
      items: [
        { id: 'a', type: 'Annotation', motivation: 'commenting', body: { type: 'TextualBody', value: 'x' }, target: 'https://example.org/c1#xywh=0,0,10,10' },
        { id: 'b', type: 'Annotation', motivation: 'commenting', body: { type: 'TextualBody', value: 'y' }, target: 'https://example.org/c1#xywh=0,0,10,10' },
      ],
    },
  ]);

  it('has no region id, so every annotation keeps its own box', () => {
    expect(plain.map((a) => a.regionId)).toEqual([undefined, undefined]);
    expect(groupByRegion(plain).map((g) => g.annotations.map((a) => a.id))).toEqual([['a'], ['b']]);
  });
});
