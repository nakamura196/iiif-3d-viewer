// places: 地図に載せる場所の読み取りと、地図の座標計算（Web メルカトル）。
// React に依存しない。この機能の担当だけがこのファイルを書く。
// - navPlace（Manifest・Canvas・Range・Collection の items。Cookbook 0154・0240・0318）
// - GeoJSON の Feature を本文に持つ tagging Annotation（Cookbook 0139）
import { geoFeaturesOf, htmlToText } from './about';
import { labelIn } from '../services/paintedModels';

type Json = Record<string, unknown>;
type LngLat = [number, number];

const isObj = (v: unknown): v is Json => !!v && typeof v === 'object' && !Array.isArray(v);
const asList = (v: unknown): unknown[] => (Array.isArray(v) ? v : v == null ? [] : [v]);
const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);

export type MapShape =
  | { kind: 'point'; coords: LngLat }
  | { kind: 'line'; coords: LngLat[] }
  | { kind: 'polygon'; rings: LngLat[][] };

export interface MapPlace {
  /** Unique in one list. */
  key: string;
  label: string;
  /** What the place belongs to. */
  scope: 'manifest' | 'canvas' | 'range' | 'annotation' | 'item';
  /** The Canvas / Scene / Timeline to show when the place is chosen. */
  containerId?: string;
  /** The Manifest or Collection to open when the place is chosen (a Collection's items). */
  resourceId?: string;
  resourceType?: string;
  /** The label of the resource the place belongs to (the Canvas, the Range, the Collection item). */
  ownerLabel?: string;
  /** The region of the Canvas, for a place given by an Annotation (e.g. "#xywh=..."). */
  target?: string;
  navDate?: string;
  shapes: MapShape[];
  /** [west, south, east, north] */
  bbox: [number, number, number, number];
}

const validPoint = (c: unknown): c is LngLat =>
  Array.isArray(c) &&
  c.length >= 2 &&
  typeof c[0] === 'number' &&
  typeof c[1] === 'number' &&
  Number.isFinite(c[0]) &&
  Number.isFinite(c[1]) &&
  Math.abs(c[0]) <= 180 &&
  Math.abs(c[1]) <= 90;

const line = (v: unknown): LngLat[] =>
  asList(v)
    .filter(validPoint)
    .map((c) => [c[0], c[1]] as LngLat);

const shapesOf = (geometry: unknown, depth = 0): MapShape[] => {
  if (!isObj(geometry) || depth > 5) return [];
  const c = geometry.coordinates;
  switch (geometry.type) {
    case 'Point':
      return validPoint(c) ? [{ kind: 'point', coords: [c[0], c[1]] }] : [];
    case 'MultiPoint':
      return line(c).map((p) => ({ kind: 'point', coords: p }));
    case 'LineString': {
      const l = line(c);
      return l.length >= 2 ? [{ kind: 'line', coords: l }] : [];
    }
    case 'MultiLineString':
      return asList(c).flatMap((l) => shapesOf({ type: 'LineString', coordinates: l }, depth + 1));
    case 'Polygon': {
      const rings = asList(c).map(line).filter((r) => r.length >= 3);
      return rings.length ? [{ kind: 'polygon', rings }] : [];
    }
    case 'MultiPolygon':
      return asList(c).flatMap((p) => shapesOf({ type: 'Polygon', coordinates: p }, depth + 1));
    case 'GeometryCollection':
      return asList(geometry.geometries).flatMap((g) => shapesOf(g, depth + 1));
    default:
      return [];
  }
};

const pointsOf = (s: MapShape): LngLat[] =>
  s.kind === 'point' ? [s.coords] : s.kind === 'line' ? s.coords : s.rings.flat();

const bboxOf = (shapes: MapShape[]): [number, number, number, number] => {
  const pts = shapes.flatMap(pointsOf);
  const lngs = pts.map((p) => p[0]);
  const lats = pts.map((p) => p[1]);
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
};

const textOf = (v: unknown, locale: string): string => htmlToText(labelIn(v, locale));

type Owner = Omit<MapPlace, 'key' | 'label' | 'shapes' | 'bbox'>;

const placesFrom = (features: Json[], owner: Owner, locale: string, out: MapPlace[]): void => {
  for (const f of features) {
    const shapes = shapesOf(f.geometry);
    if (shapes.length === 0) continue;
    const props = isObj(f.properties) ? f.properties : {};
    out.push({
      key: `${out.length}`,
      label: textOf(props.label, locale),
      ...owner,
      shapes,
      bbox: bboxOf(shapes),
    });
  }
};

const fragmentOf = (target: unknown): { source?: string; fragment?: string } => {
  const id = typeof target === 'string' ? target : isObj(target) ? (str(target.id) ?? str(target.source)) : undefined;
  if (!id) return {};
  const i = id.indexOf('#');
  if (i < 0) return { source: id };
  return { source: id.slice(0, i), fragment: id.slice(i) };
};

const collectRanges = (v: unknown, locale: string, out: MapPlace[], depth = 0): void => {
  if (depth > 20) return;
  for (const r of asList(v)) {
    if (!isObj(r) || r.type !== 'Range') continue;
    // 目次の項目の場所。開くのは、その項目の最初の Canvas
    const first = asList(r.items).find((i) => isObj(i) && (i.type === 'Canvas' || typeof i === 'string'));
    const containerId = typeof first === 'string' ? first : isObj(first) ? str(first.id) : undefined;
    placesFrom(geoFeaturesOf(r.navPlace), { scope: 'range', containerId, ownerLabel: textOf(r.label, locale) }, locale, out);
    collectRanges(r.items, locale, out, depth + 1);
  }
};

/**
 * Every place in a Manifest or a Collection (as the JSON says it, Presentation 3).
 * For a Collection, the places of its items (Manifests / Collections) come with `resourceId`.
 */
export const mapPlacesOf = (resource: unknown, locale: string): MapPlace[] => {
  if (!isObj(resource)) return [];
  const out: MapPlace[] = [];
  const type = str(resource.type) ?? '';
  const navDate = str(resource.navDate);
  placesFrom(geoFeaturesOf(resource.navPlace), { scope: 'manifest', navDate }, locale, out);

  if (type === 'Collection') {
    for (const item of asList(resource.items)) {
      if (!isObj(item)) continue;
      placesFrom(
        geoFeaturesOf(item.navPlace),
        {
          scope: 'item',
          resourceId: str(item.id),
          resourceType: str(item.type),
          ownerLabel: textOf(item.label, locale),
          navDate: str(item.navDate),
        },
        locale,
        out,
      );
    }
    return out;
  }

  for (const c of asList(resource.items)) {
    if (!isObj(c)) continue;
    const containerId = str(c.id);
    const ownerLabel = textOf(c.label, locale);
    placesFrom(geoFeaturesOf(c.navPlace), { scope: 'canvas', containerId, ownerLabel, navDate: str(c.navDate) }, locale, out);
    for (const page of asList(c.annotations)) {
      if (!isObj(page)) continue;
      for (const anno of asList(page.items)) {
        if (!isObj(anno)) continue;
        const { fragment } = fragmentOf(anno.target);
        placesFrom(geoFeaturesOf(anno.body), { scope: 'annotation', containerId, ownerLabel, target: fragment }, locale, out);
      }
    }
  }
  collectRanges(resource.structures, locale, out);
  return out;
};

/** The box that holds all the places, or undefined when there is none. */
export const mapBoundsOf = (places: MapPlace[]): [number, number, number, number] | undefined => {
  if (places.length === 0) return undefined;
  return [
    Math.min(...places.map((p) => p.bbox[0])),
    Math.min(...places.map((p) => p.bbox[1])),
    Math.max(...places.map((p) => p.bbox[2])),
    Math.max(...places.map((p) => p.bbox[3])),
  ];
};

// ---------------------------------------------------------------------------
// Web メルカトル（地図タイルと同じ投影）。座標は、ズーム 0 の世界を 256 px とした値
// ---------------------------------------------------------------------------

export const TILE_SIZE = 256;
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 18;
const MAX_LAT = 85.0511287798;

/** lng/lat → pixel at zoom 0 (0..256). */
export const project = ([lng, lat]: LngLat): [number, number] => {
  const l = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat));
  const s = Math.sin((l * Math.PI) / 180);
  const x = ((lng + 180) / 360) * TILE_SIZE;
  const y = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * TILE_SIZE;
  return [x, y];
};

/** pixel at zoom 0 → lng/lat. */
export const unproject = ([x, y]: [number, number]): LngLat => {
  const lng = (x / TILE_SIZE) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / TILE_SIZE;
  const lat = (180 / Math.PI) * Math.atan(Math.sinh(n));
  return [lng, lat];
};

export interface MapView {
  center: LngLat;
  zoom: number;
}

export const clampZoom = (z: number): number => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));

/** The view that shows the whole box in a width × height frame, with `padding` px on each side. */
export const fitMapView = (
  bbox: [number, number, number, number],
  width: number,
  height: number,
  padding = 24,
  maxZoom = 14,
): MapView => {
  const [x0, y1] = project([bbox[0], bbox[1]]);
  const [x1, y0] = project([bbox[2], bbox[3]]);
  const center = unproject([(x0 + x1) / 2, (y0 + y1) / 2]);
  const w = Math.max(width - padding * 2, 1);
  const h = Math.max(height - padding * 2, 1);
  const dx = x1 - x0;
  const dy = y1 - y0;
  const zoom = dx === 0 && dy === 0 ? maxZoom : Math.log2(Math.min(dx ? w / dx : Infinity, dy ? h / dy : Infinity));
  return { center, zoom: clampZoom(Math.min(zoom, maxZoom)) };
};

export interface MapTile {
  key: string;
  url: string;
  /** Top-left corner in the frame, px. */
  left: number;
  top: number;
  size: number;
}

/** The tiles that cover a width × height frame. `{z}/{x}/{y}` in the template are filled in. */
export const tilesFor = (view: MapView, width: number, height: number, template: string): MapTile[] => {
  const z = Math.max(0, Math.min(MAX_ZOOM, Math.round(view.zoom)));
  const scale = 2 ** (view.zoom - z); // タイル 1 枚の拡大率（ズームが整数でないとき）
  const size = TILE_SIZE * scale;
  const [cx, cy] = project(view.center).map((v) => v * 2 ** view.zoom);
  const originX = cx - width / 2;
  const originY = cy - height / 2;
  const n = 2 ** z;
  const out: MapTile[] = [];
  for (let ty = Math.floor(originY / size); ty * size < originY + height; ty++) {
    if (ty < 0 || ty >= n) continue;
    for (let tx = Math.floor(originX / size); tx * size < originX + width; tx++) {
      const wx = ((tx % n) + n) % n; // 経度方向は繰り返す
      out.push({
        key: `${z}/${tx}/${ty}`,
        url: template.replace('{z}', String(z)).replace('{x}', String(wx)).replace('{y}', String(ty)),
        left: tx * size - originX,
        top: ty * size - originY,
        size,
      });
    }
  }
  return out;
};

/** lng/lat → px in the frame. */
export const toFrame = (p: LngLat, view: MapView, width: number, height: number): [number, number] => {
  const k = 2 ** view.zoom;
  const [cx, cy] = project(view.center);
  const [x, y] = project(p);
  return [(x - cx) * k + width / 2, (y - cy) * k + height / 2];
};

/** px in the frame → lng/lat. */
export const fromFrame = (px: [number, number], view: MapView, width: number, height: number): LngLat => {
  const k = 2 ** view.zoom;
  const [cx, cy] = project(view.center);
  return unproject([cx + (px[0] - width / 2) / k, cy + (px[1] - height / 2) / k]);
};

/** Zoom by `delta` keeping the lng/lat under `px` in place. */
export const zoomAround = (view: MapView, delta: number, px: [number, number], width: number, height: number): MapView => {
  const zoom = clampZoom(view.zoom + delta);
  const anchor = fromFrame(px, view, width, height);
  const k = 2 ** zoom;
  const [ax, ay] = project(anchor);
  const center = unproject([ax - (px[0] - width / 2) / k, ay - (px[1] - height / 2) / k]);
  return { center, zoom };
};

/** Move the view by (dx, dy) px. */
export const panBy = (view: MapView, dx: number, dy: number): MapView => {
  const k = 2 ** view.zoom;
  const [cx, cy] = project(view.center);
  const y = Math.max(0, Math.min(TILE_SIZE, cy - dy / k));
  const [lng, lat] = unproject([cx - dx / k, y]);
  return { center: [((((lng + 180) % 360) + 360) % 360) - 180, lat], zoom: view.zoom };
};
