import { describe, expect, it } from 'vitest';
import type { ManifestV4 } from '@/types/iiif';
import { defaultCameraOf, parseManifestV4, sceneCamerasOf } from './manifestParser';

// Presentation 4.0 style, as written by train-bodies: Cameras are painted into
// Scene.items (body.type PerspectiveCamera, hidden ones for the notes), and each
// commenting Annotation names its Camera with `scope` and its heading with `label`.
const S = 'https://example.org/iiif/car/scene';
const camera = (id: string, position: number[], lookAt: number[], hidden = false) => ({
  id,
  type: 'Annotation',
  motivation: ['painting'],
  body: {
    id: `${id}/body`,
    type: 'PerspectiveCamera',
    label: { ja: ['カメラ'] },
    lookAt: { type: 'PointSelector', x: lookAt[0], y: lookAt[1], z: lookAt[2] },
  },
  target: {
    type: 'SpecificResource',
    source: { id: S, type: 'Scene' },
    selector: [{ type: 'PointSelector', x: position[0], y: position[1], z: position[2] }],
  },
  ...(hidden ? { behavior: ['hidden'] } : {}),
});

const manifest = {
  '@context': 'http://iiif.io/api/presentation/4/context.json',
  id: 'https://example.org/iiif/car/manifest.json',
  type: 'Manifest',
  items: [{
    id: S,
    type: 'Scene',
    items: [{
      type: 'AnnotationPage',
      items: [
        { id: `${S}/model`, type: 'Annotation', motivation: ['painting'], body: { id: 'https://example.org/car.glb', type: 'Model' }, target: S },
        camera(`${S}/camera/default`, [-110, 70, 150], [60, 15, 0]),
        camera('https://example.org/anno/windscreen/cam', [-13, 82, 0], [19, 26, 1], true),
      ],
    }],
    annotations: [{
      type: 'AnnotationPage',
      items: [{
        id: 'https://example.org/anno/windscreen',
        type: 'Annotation',
        motivation: ['commenting'],
        label: { ja: ['前面ガラス'], en: ['Windscreen'] },
        body: [{ type: 'TextualBody', value: '運転室の前面ガラス。', language: 'ja', purpose: 'describing' }],
        target: {
          type: 'SpecificResource',
          source: { id: S, type: 'Scene' },
          selector: [{ type: 'PointSelector', x: 19, y: 26, z: 0 }],
        },
        scope: [{ id: 'https://example.org/anno/windscreen/cam', type: 'Annotation' }],
      }],
    }],
  }],
} as unknown as ManifestV4;

describe('Presentation 4.0 cameras and labels', () => {
  const { annotations } = parseManifestV4(manifest);

  it('lists only the commenting Annotation, not the painted Cameras', () => {
    expect(annotations.map((a) => a.id)).toEqual(['https://example.org/anno/windscreen']);
  });

  it('takes the heading from the Annotation label', () => {
    expect(annotations[0].title).toBe('前面ガラス');
    expect(annotations[0].description).toBe('運転室の前面ガラス。');
  });

  it('views a note with the Camera named in its scope, keeping lookAt', () => {
    const { camPos, camLookAt } = annotations[0].data.target.selector;
    expect(camPos).toEqual([-13, 82, 0]);
    expect(camLookAt).toEqual([19, 26, 1]);
  });

  it('still starts from the first Camera that is not hidden', () => {
    expect(defaultCameraOf(manifest)).toEqual({ position: [-110, 70, 150], lookAt: [60, 15, 0] });
  });

  it('falls back to the point when scope names no Camera', () => {
    const anno = (manifest.items[0].annotations![0].items[0]);
    const noScope = structuredClone(manifest);
    noScope.items[0].annotations![0].items[0] = { ...anno, scope: 'https://example.org/missing' };
    const [a] = parseManifestV4(noScope).annotations;
    expect(a.data.target.selector.camPos).toEqual([19, 26, 0]);
    expect(a.data.target.selector.camLookAt).toBeUndefined();
  });
});

describe('sceneCamerasOf', () => {
  it('lists the Cameras painted into the Scene, leaving out hidden ones', () => {
    const cams = sceneCamerasOf(manifest);
    expect(cams.map((c) => c.id)).toEqual([`${S}/camera/default`]);
    expect(cams[0]).toMatchObject({ position: [-110, 70, 150], lookAt: [60, 15, 0], label: { ja: ['カメラ'] } });
  });

  it('is empty without a manifest', () => {
    expect(sceneCamerasOf(null)).toEqual([]);
  });
});
