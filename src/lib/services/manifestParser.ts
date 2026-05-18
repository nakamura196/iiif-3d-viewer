// Read a v4 IIIF Manifest and project it into the viewer's internal
// Annotation / GeoFeature shapes. Input is expected to already be v4
// (use convertToV4 first if the source is the legacy format).

import type {
  AnnotationLinkV4,
  AnnotationPageV4,
  AnnotationV4,
  ManifestV4,
  PointSelectorV4,
  SceneV4,
  SelectorV4,
  SpecificResourceV4,
  WKTSelectorV4,
} from '@/types/iiif';
import type { Annotation } from '@/types/main';

export interface GeoFeatureName {
  toponym: string;
  lang: string;
  citations?: { label: string; '@id': string }[];
}

export interface GeoFeatureLink {
  type: string;
  identifier: string;
}

export interface GeoFeatureDepiction {
  '@id': string;
}

export interface GeoFeature {
  '@id': string;
  type: 'Feature';
  geometry: { coordinates: [number, number]; type: 'Point' };
  properties: { title: string; resourceCoords: [number, number, number] };
  names?: GeoFeatureName[];
  links?: GeoFeatureLink[];
  depictions?: GeoFeatureDepiction[];
}

export interface ParsedManifest {
  modelUrl: string | null;
  annotations: Annotation[];
  geoFeatures: GeoFeature[];
}

const ZERO: [number, number, number] = [0, 0, 0];

const motivationsOf = (anno: AnnotationV4): string[] => {
  const m = anno.motivation;
  if (Array.isArray(m)) return m;
  if (typeof m === 'string') return [m];
  return [];
};

const isPointSelector = (s: SelectorV4): s is PointSelectorV4 =>
  s?.type === 'PointSelector';

const isWktSelector = (s: SelectorV4): s is WKTSelectorV4 =>
  s?.type === 'WKTSelector';

const targetSelectors = (anno: AnnotationV4): SelectorV4[] => {
  const t = anno.target as SpecificResourceV4 | undefined;
  if (!t || typeof t !== 'object') return [];
  return Array.isArray(t.selector) ? t.selector : [];
};

const parseWktPolygonZ = (wkt: string): number[] => {
  // POLYGON Z ((x y z, x y z, ...))  — only the first ring is consumed.
  const open = wkt.indexOf('((');
  const close = wkt.indexOf('))', open);
  if (open < 0 || close < 0) return [];
  const ring = wkt.slice(open + 2, close);
  const out: number[] = [];
  for (const raw of ring.split(',')) {
    const [x, y, z] = raw.trim().split(/\s+/).map(Number);
    if ([x, y, z].every((n) => Number.isFinite(n))) out.push(x, y, z);
  }
  return out;
};

const polygonCentroid = (flat: number[]): [number, number, number] => {
  if (flat.length < 3) return [...ZERO];
  let sx = 0;
  let sy = 0;
  let sz = 0;
  let n = 0;
  for (let i = 0; i + 2 < flat.length; i += 3) {
    sx += flat[i];
    sy += flat[i + 1];
    sz += flat[i + 2];
    n++;
  }
  return n === 0 ? [...ZERO] : [sx / n, sy / n, sz / n];
};

const flattenAllPages = (pages: AnnotationPageV4[] | undefined): AnnotationV4[] => {
  if (!pages) return [];
  const out: AnnotationV4[] = [];
  for (const page of pages) {
    for (const anno of page.items ?? []) out.push(anno);
  }
  return out;
};

const cameraIndex = (annos: AnnotationV4[]): Map<string, [number, number, number]> => {
  const map = new Map<string, [number, number, number]>();
  for (const anno of annos) {
    if (!motivationsOf(anno).includes('painting')) continue;
    const body = anno.body as { source?: Array<{ type?: string }> } | undefined;
    const isCamera = Array.isArray(body?.source)
      && body!.source!.some((s) => s?.type === 'PerspectiveCamera');
    if (!isCamera) continue;
    const sel = targetSelectors(anno).find(isPointSelector);
    if (!sel) continue;
    map.set(anno.id, [sel.x, sel.y, sel.z]);
  }
  return map;
};

const extractModelUrl = (scene: SceneV4 | undefined): string | null => {
  if (!scene) return null;
  for (const page of scene.items ?? []) {
    for (const anno of page.items ?? []) {
      if (!motivationsOf(anno).includes('painting')) continue;
      const body = anno.body as { id?: string; type?: string } | undefined;
      if (body?.type === 'Model' && typeof body.id === 'string') return body.id;
    }
  }
  return null;
};

const extractGeoFeatures = (annos: AnnotationV4[]): GeoFeature[] => {
  const out: GeoFeature[] = [];
  for (const anno of annos) {
    if (!motivationsOf(anno).includes('georeferencing')) continue;
    const body = anno.body as { type?: string; features?: GeoFeature[] } | undefined;
    if (body?.type === 'FeatureCollection' && Array.isArray(body.features)) {
      out.push(...body.features);
    }
  }
  return out;
};

const stringifyBodyValue = (anno: AnnotationV4): { value: string; label: string } => {
  if (typeof anno.bodyValue === 'string') {
    return { value: anno.bodyValue, label: anno.bodyValue };
  }
  const body = anno.body as { value?: unknown; label?: unknown; type?: string } | undefined;
  const value = typeof body?.value === 'string' ? body.value : '';
  const label = typeof body?.label === 'string' ? body.label : '';
  return { value, label };
};

const buildAnnotation = (
  anno: AnnotationV4,
  cameras: Map<string, [number, number, number]>,
  fallbackIndex: number,
): Annotation | null => {
  const selectors = targetSelectors(anno);
  if (selectors.length === 0) return null;

  const point = selectors.find(isPointSelector);
  const polygon = selectors.find(isWktSelector);

  let position: [number, number, number] = [...ZERO];
  let area: [number, number, number] = [...ZERO];
  let selectorType: 'PointSelector' | 'WKTSelector' = 'PointSelector';

  if (polygon) {
    const flat = parseWktPolygonZ(polygon.value);
    selectorType = 'WKTSelector';
    position = polygonCentroid(flat);
    area = flat as unknown as [number, number, number];
  } else if (point) {
    selectorType = 'PointSelector';
    position = [point.x, point.y, point.z];
  } else {
    return null;
  }

  const cameraId = anno.cameraAnnotation ?? `${anno.id}/camera`;
  const camPos = cameras.get(cameraId) ?? ([...position] as [number, number, number]);

  const { value, label } = stringifyBodyValue(anno);

  return {
    id: anno.id || `annotation-${fallbackIndex}`,
    creator: '',
    title: label,
    description: value,
    media: [],
    wikidata: [],
    bibliography: [],
    position: { x: position[0], y: position[1], z: position[2] },
    seeAlso: anno.seeAlso as AnnotationLinkV4[] | undefined,
    data: {
      body: { value, label },
      target: {
        selector: {
          type: selectorType,
          value: position,
          area,
          camPos,
        },
      },
    },
  };
};

export const parseManifestV4 = (manifest: ManifestV4): ParsedManifest => {
  const scene = manifest?.items?.[0];
  const modelUrl = extractModelUrl(scene);

  const sceneAnnotations = flattenAllPages(scene?.annotations);
  const cameras = cameraIndex(sceneAnnotations);
  const geoFeatures = extractGeoFeatures(sceneAnnotations);

  const out: Annotation[] = [];
  let i = 0;
  for (const anno of sceneAnnotations) {
    const motivations = motivationsOf(anno);
    if (motivations.includes('georeferencing')) continue;
    // Skip camera annotations themselves; they only feed `cameras`.
    if (cameras.has(anno.id)) continue;
    const built = buildAnnotation(anno, cameras, i);
    if (built) out.push(built);
    i++;
  }

  return { modelUrl, annotations: out, geoFeatures };
};

export const geoFeaturesToAnnotations = (features: GeoFeature[]): Annotation[] =>
  features.map((feature, idx) => {
    const coords = feature.properties.resourceCoords;
    return {
      id: feature['@id'] || `geo-feature-${idx}`,
      creator: '',
      title: feature.properties.title,
      description: '',
      media: [],
      wikidata: [],
      bibliography: [],
      position: { x: coords[0], y: coords[1], z: coords[2] },
      data: {
        body: { value: '', label: feature.properties.title },
        target: {
          selector: {
            type: 'PointSelector',
            value: coords,
            area: [...ZERO],
            camPos: [coords[0] * 1.5, coords[1] * 1.5, coords[2] * 1.5],
          },
        },
      },
    };
  });
