// Convert legacy IIIF Presentation 3 manifests with the project's custom
// 3DSelector / camPos extension into IIIF 3D TSG (Presentation 4) form.
//
// - Canvas       -> Scene
// - 3DSelector   -> PointSelector { x, y, z } or WKTSelector POLYGON Z
// - target string-> SpecificResource { source:[Scene], selector:[...] }
// - camPos       -> separate PerspectiveCamera Annotation,
//                   id = `${annotation.id}/camera`
// - motivation   -> always an array
//
// If the input already declares Presentation 4 context, it is returned
// untouched.

import type {
  AnnotationPageV4,
  AnnotationV4,
  ManifestV4,
  SceneV4,
  SpecificResourceV4,
} from '@/types/iiif';

const V4_CONTEXT = 'http://iiif.io/api/presentation/4/context.json';

type Triple = [number, number, number];

interface LegacySelector {
  type?: string;
  value?: number[];
  area?: number[];
  camPos?: number[];
}

interface LegacyTargetObject {
  source?: string | { id?: string; type?: string };
  selector?: LegacySelector;
}

interface LegacyAnnotation {
  id?: string;
  type?: string;
  motivation?: string | string[];
  body?: unknown;
  bodyValue?: string;
  target?: string | LegacyTargetObject;
  seeAlso?: unknown;
  [extra: string]: unknown;
}

interface LegacyAnnotationPage {
  id?: string;
  type?: string;
  items?: LegacyAnnotation[];
}

interface LegacyContainer {
  id?: string;
  type?: string;
  label?: unknown;
  items?: LegacyAnnotationPage[];
  annotations?: LegacyAnnotationPage[];
  [extra: string]: unknown;
}

interface LegacyManifest {
  '@context'?: string | string[];
  id?: string;
  type?: string;
  items?: LegacyContainer[];
  [extra: string]: unknown;
}

const isV4 = (manifest: LegacyManifest): boolean => {
  const ctx = manifest['@context'];
  if (!ctx) return false;
  const list = Array.isArray(ctx) ? ctx : [ctx];
  return list.some((c) => typeof c === 'string' && c.includes('/presentation/4/'));
};

const asTriple = (input: number[] | undefined): Triple | null => {
  if (!input || input.length < 3) return null;
  return [Number(input[0]), Number(input[1]), Number(input[2])];
};

const buildPointSelector = (xyz: Triple) => ({
  type: 'PointSelector' as const,
  x: xyz[0],
  y: xyz[1],
  z: xyz[2],
});

const buildWktPolygon = (area: number[]): string => {
  const points: string[] = [];
  for (let i = 0; i + 2 < area.length; i += 3) {
    points.push(`${area[i]} ${area[i + 1]} ${area[i + 2]}`);
  }
  return `POLYGON Z ((${points.join(', ')}))`;
};

const buildSceneSource = (sceneId: string): SpecificResourceV4['source'] => [
  { id: sceneId, type: 'Scene' },
];

const normalizeMotivation = (m: unknown): string[] => {
  if (Array.isArray(m)) return m.map(String);
  if (typeof m === 'string') return [m];
  return [];
};

const convertCommentingAnnotation = (
  anno: LegacyAnnotation,
  sceneId: string,
): { annotation: AnnotationV4; camera: AnnotationV4 | null } => {
  const target = (anno.target ?? {}) as LegacyTargetObject;
  const selector: LegacySelector = (typeof target === 'object' && target.selector) || {};
  const value = asTriple(selector.value);
  const camPos = asTriple(selector.camPos);
  const area = selector.area && selector.area.length >= 9 ? selector.area : null;

  const v4Selector = area
    ? { type: 'WKTSelector' as const, value: buildWktPolygon(area) }
    : value
      ? buildPointSelector(value)
      : null;

  const annotationId = anno.id ?? `${sceneId}/anno/${Math.random().toString(36).slice(2, 10)}`;

  const v4Target: SpecificResourceV4 = {
    type: 'SpecificResource',
    source: buildSceneSource(sceneId),
    ...(v4Selector ? { selector: [v4Selector] } : {}),
  };

  const motivation = normalizeMotivation(anno.motivation);

  const annotation: AnnotationV4 = {
    id: annotationId,
    type: 'Annotation',
    motivation: motivation.length > 0 ? motivation : ['commenting'],
    target: v4Target,
    ...(anno.body !== undefined ? { body: anno.body as AnnotationV4['body'] } : {}),
    ...(anno.bodyValue !== undefined ? { bodyValue: anno.bodyValue } : {}),
    ...(anno.seeAlso !== undefined
      ? { seeAlso: anno.seeAlso as AnnotationV4['seeAlso'] }
      : {}),
    ...(camPos ? { cameraAnnotation: `${annotationId}/camera` } : {}),
  };

  if (!camPos) {
    return { annotation, camera: null };
  }

  const camera: AnnotationV4 = {
    id: `${annotationId}/camera`,
    type: 'Annotation',
    motivation: ['painting'],
    body: {
      type: 'SpecificResource',
      source: [
        {
          type: 'PerspectiveCamera',
        },
      ],
    },
    target: {
      type: 'SpecificResource',
      source: buildSceneSource(sceneId),
      selector: [buildPointSelector(camPos)],
    },
  };

  return { annotation, camera };
};

const convertModelAnnotation = (
  anno: LegacyAnnotation,
  sceneId: string,
): AnnotationV4 => {
  const motivation = normalizeMotivation(anno.motivation);
  return {
    id: anno.id ?? `${sceneId}/model`,
    type: 'Annotation',
    motivation: motivation.length > 0 ? motivation : ['painting'],
    body: anno.body as AnnotationV4['body'],
    target: {
      type: 'SpecificResource',
      source: buildSceneSource(sceneId),
      selector: [buildPointSelector([0, 0, 0])],
    },
  };
};

const passthroughGeoreferencing = (
  anno: LegacyAnnotation,
  sceneId: string,
): AnnotationV4 => ({
  id: anno.id ?? `${sceneId}/georef`,
  type: 'Annotation',
  motivation: ['georeferencing'],
  body: anno.body as AnnotationV4['body'],
  target: {
    type: 'SpecificResource',
    source: buildSceneSource(sceneId),
  },
});

const convertCanvasToScene = (canvas: LegacyContainer): SceneV4 => {
  const sceneId = canvas.id ?? 'urn:scene';

  const itemsPages: AnnotationPageV4[] = (canvas.items ?? []).map((page, pageIndex) => {
    const v4Items: AnnotationV4[] = [];
    for (const anno of page.items ?? []) {
      const motivation = normalizeMotivation(anno.motivation);
      if (motivation.includes('painting')) {
        v4Items.push(convertModelAnnotation(anno, sceneId));
      } else {
        // Unknown motivation in items[] is rare; fall back to commenting handling.
        const { annotation } = convertCommentingAnnotation(anno, sceneId);
        v4Items.push(annotation);
      }
    }
    return {
      id: page.id ?? `${sceneId}/page/items/${pageIndex}`,
      type: 'AnnotationPage',
      items: v4Items,
    };
  });

  const annotationsPages: AnnotationPageV4[] = [];
  const cameraAnnotations: AnnotationV4[] = [];
  for (const [pageIndex, page] of (canvas.annotations ?? []).entries()) {
    const v4Items: AnnotationV4[] = [];
    for (const anno of page.items ?? []) {
      const motivation = normalizeMotivation(anno.motivation);
      if (motivation.includes('georeferencing')) {
        v4Items.push(passthroughGeoreferencing(anno, sceneId));
        continue;
      }
      const { annotation, camera } = convertCommentingAnnotation(anno, sceneId);
      v4Items.push(annotation);
      if (camera) cameraAnnotations.push(camera);
    }
    annotationsPages.push({
      id: page.id ?? `${sceneId}/page/annotations/${pageIndex}`,
      type: 'AnnotationPage',
      items: v4Items,
    });
  }

  if (cameraAnnotations.length > 0) {
    annotationsPages.push({
      id: `${sceneId}/page/cameras`,
      type: 'AnnotationPage',
      items: cameraAnnotations,
    });
  }

  return {
    id: sceneId,
    type: 'Scene',
    ...(canvas.label !== undefined ? { label: canvas.label as SceneV4['label'] } : {}),
    items: itemsPages,
    annotations: annotationsPages,
  };
};

export const convertToV4 = (manifest: unknown): ManifestV4 => {
  const m = (manifest ?? {}) as LegacyManifest;

  if (isV4(m)) {
    return m as unknown as ManifestV4;
  }

  const scenes: SceneV4[] = (m.items ?? []).map(convertCanvasToScene);

  const next: Record<string, unknown> = { ...m };
  next['@context'] = V4_CONTEXT;
  next.items = scenes;

  return next as unknown as ManifestV4;
};
