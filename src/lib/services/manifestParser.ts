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
import type { Annotation, AnnotationImage, AnnotationTag } from '@/types/main';
import { paintedModelsOf } from '@/lib/services/paintedModels';

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
  s?.type === 'WktSelector' || s?.type === 'WKTSelector';

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

// The model shown when only one is used: the first painted Model (for a Choice,
// its first item — the default).
const extractModelUrl = (scene: SceneV4 | undefined): string | null =>
  paintedModelsOf(scene)[0]?.options[0]?.url ?? null;

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

// A label may be a plain string or a IIIF language map.
const localizedString = (label: unknown): string => {
  if (typeof label === 'string') return label;
  if (Array.isArray(label)) return label.map(String).join(' ');
  if (label && typeof label === 'object') {
    const map = label as Record<string, unknown>;
    for (const lang of ['none', 'ja', 'en', ...Object.keys(map)]) {
      const v = map[lang];
      if (Array.isArray(v) && v.length > 0) return v.map(String).join(' ');
      if (typeof v === 'string') return v;
    }
  }
  return '';
};

const hasPurpose = (body: Record<string, unknown>, purpose: string): boolean => {
  const p = body.purpose;
  return Array.isArray(p) ? p.includes(purpose) : p === purpose;
};

const firstOf = (v: unknown): Record<string, unknown> | undefined => {
  const item = Array.isArray(v) ? v[0] : v;
  return item && typeof item === 'object' ? (item as Record<string, unknown>) : undefined;
};

// An Image body (§5 Images in an annotation, Region & Tag extension draft).
const parseImage = (body: Record<string, unknown>): AnnotationImage | null => {
  if (typeof body.id !== 'string') return null;
  const service = firstOf(body.service);
  const homepage = firstOf(body.homepage);
  const serviceId = service?.id ?? service?.['@id'];
  return {
    id: body.id,
    ...(body.label ? { label: localizedString(body.label) } : {}),
    ...(typeof body.format === 'string' ? { format: body.format } : {}),
    ...(hasPurpose(body, 'linking') ? { purpose: 'linking' } : hasPurpose(body, 'describing') ? { purpose: 'describing' } : {}),
    ...(typeof serviceId === 'string' ? { service: serviceId.replace(/\/info\.json$/, '') } : {}),
    ...(typeof homepage?.id === 'string' ? { homepage: homepage.id } : {}),
    ...(homepage?.label ? { homepageLabel: localizedString(homepage.label) } : {}),
  };
};

// The first non-tagging, non-Image body is the description. Tagging bodies become tags,
// with the body's label as the tag's key (Keyed Tag extension). Image bodies are
// pictures of the annotated place.
const parseBodies = (
  anno: AnnotationV4,
): { value: string; label: string; tags: AnnotationTag[]; images: AnnotationImage[] } => {
  if (typeof anno.bodyValue === 'string') {
    return { value: anno.bodyValue, label: anno.bodyValue, tags: [], images: [] };
  }
  const raw = anno.body;
  const bodies = (Array.isArray(raw) ? raw : raw ? [raw] : []) as Record<string, unknown>[];
  const tags: AnnotationTag[] = [];
  const images: AnnotationImage[] = [];
  let main: Record<string, unknown> | undefined;
  for (const body of bodies) {
    if (!body || typeof body !== 'object') continue;
    if (hasPurpose(body, 'tagging')) {
      if (typeof body.value !== 'string' || body.value === '') continue;
      const key = localizedString(body.label);
      tags.push(key ? { key, value: body.value } : { value: body.value });
    } else if (body.type === 'Image') {
      const image = parseImage(body);
      if (image) images.push(image);
    } else if (!main) {
      main = body;
    }
  }
  const value = typeof main?.value === 'string' ? main.value : '';
  const label = localizedString(main?.label);
  return { value, label, tags, images };
};

const creatorName = (creator: AnnotationV4['creator']): string => {
  const list = Array.isArray(creator) ? creator : creator ? [creator] : [];
  return list
    .map((c) => (typeof c === 'string' ? c : c.name ?? c.nickname ?? c.id ?? ''))
    .filter(Boolean)
    .join(', ');
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

  // Outward normal of the annotated feature (non-standard PointSelector field),
  // used to frame the feature head-on when there is no explicit camera.
  const normal = point && Array.isArray(point.normal) && point.normal.length >= 3
    ? ([point.normal[0], point.normal[1], point.normal[2]] as [number, number, number])
    : undefined;

  const { value, label, tags, images } = parseBodies(anno);
  const regionId = typeof anno.target === 'object' ? anno.target.id : undefined;

  return {
    id: anno.id || `annotation-${fallbackIndex}`,
    creator: creatorName(anno.creator),
    title: label,
    description: value,
    media: [],
    wikidata: [],
    bibliography: [],
    position: { x: position[0], y: position[1], z: position[2] },
    seeAlso: anno.seeAlso as AnnotationLinkV4[] | undefined,
    ...(regionId ? { regionId } : {}),
    ...(tags.length > 0 ? { tags } : {}),
    ...(images.length > 0 ? { images } : {}),
    ...(anno.created ? { created: anno.created } : {}),
    data: {
      body: { value, label },
      target: {
        selector: {
          type: selectorType,
          value: position,
          area,
          camPos,
          ...(normal ? { normal } : {}),
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

export interface DefaultCamera {
  position: [number, number, number];
  // null: look at the model (the client decides)
  lookAt: [number, number, number] | null;
  fieldOfView?: number;
}

const pointOf = (sel: unknown): [number, number, number] | null => {
  const s = sel as { type?: string; x?: unknown; y?: unknown; z?: unknown } | undefined;
  if (s?.type !== 'PointSelector') return null;
  const v = [s.x ?? 0, s.y ?? 0, s.z ?? 0].map(Number);
  return v.every(Number.isFinite) ? (v as [number, number, number]) : null;
};

// The default Camera of the first Scene (Presentation 4.0, Cameras): the first Camera
// painted into the Scene (a painting Annotation in Scene.items) without the `hidden`
// behavior. Position from the target's PointSelector, direction from `lookAt` (an
// embedded PointSelector, or a reference to an Annotation that targets a point).
export const defaultCameraOf = (manifest: ManifestV4 | null | undefined): DefaultCamera | null => {
  const scene = manifest?.items?.[0];
  const annos = (scene?.items ?? []).flatMap((page) => page.items ?? []);
  for (const anno of annos) {
    if (!motivationsOf(anno).includes('painting')) continue;
    const raw = anno.body as unknown;
    const body = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown> | undefined;
    if (typeof body?.type !== 'string' || !/Camera$/.test(body.type)) continue;
    const behavior = [(anno as { behavior?: unknown }).behavior, body.behavior].flat().filter(Boolean) as string[];
    if (behavior.includes('hidden')) continue;
    const position = targetSelectors(anno).map(pointOf).find(Boolean) ?? [0, 0, 0];
    let lookAt = pointOf(body.lookAt);
    const ref = (body.lookAt as { id?: string } | undefined)?.id;
    if (!lookAt && ref) {
      const target = [...annos, ...flattenAllPages(scene?.annotations)].find((a) => a.id === ref);
      lookAt = target ? targetSelectors(target).map(pointOf).find(Boolean) ?? null : null;
    }
    const fov = Number(body.fieldOfView);
    return { position, lookAt, ...(Number.isFinite(fov) && fov > 0 ? { fieldOfView: fov } : {}) };
  }
  return null;
};

// The commenting Annotation that describes a georeferenced feature: the one whose id
// is the feature's @id, or ends with "#<@id>" / "/<@id>" (as in the sample manifests,
// where both are minted from the same key).
const describes = (anno: Annotation, featureId: string) =>
  anno.id === featureId || anno.id.endsWith(`#${featureId}`) || anno.id.endsWith(`/${featureId}`);

// Annotations for the georeferencing page: one per feature, keyed by the feature's id
// (the map selects by it). A feature takes the description, images, tags and camera of
// its commenting Annotation when there is one; otherwise it is built from the feature
// alone (geoFeaturesToAnnotations). Depictions become images.
export const geoAnnotations = (features: GeoFeature[], annotations: Annotation[]): Annotation[] => {
  const plain = geoFeaturesToAnnotations(features);
  return features.map((feature, idx) => {
    const id = plain[idx].id;
    const match = annotations.find((a) => describes(a, id));
    const base = match ? { ...match, id } : plain[idx];
    const depictions = (feature.depictions ?? []).filter((d) => typeof d['@id'] === 'string');
    return !base.images?.length && depictions.length > 0
      ? { ...base, images: depictions.map((d) => ({ id: d['@id'] })) }
      : base;
  });
};
