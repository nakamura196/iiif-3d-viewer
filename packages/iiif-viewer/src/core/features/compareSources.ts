// compareSources: 見比べる画像を、Choice の候補ではなく別々の資料（Manifest・Collection・info.json）から集める。
// React に依存しない。

import { labelIn } from '../services/paintedModels';
import { manifestItemsOf } from './annotations';
import {
  canvasImagesOf,
  chosenLayersOf,
  detailWidthOf,
  parseImageInfo,
  paintsImage,
  type CanvasImages,
  type CanvasPainting,
  type ImageLayer,
} from './image';
import { collectionEntriesOf } from './structure';

/** One side of a comparison: the images drawn on a frame of this size. */
export interface CompareSide {
  layers: ImageLayer[];
  width: number;
  height: number;
}

/** An image that can be put on either side, with the name shown in the A / B menus. */
export interface CompareCandidate {
  label: string;
  side: CompareSide;
}

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const asList = (v: unknown): unknown[] => (Array.isArray(v) ? v : v == null ? [] : [v]);
const text = (v: unknown): string => asList(v).filter((x): x is string => typeof x === 'string').join(' ');

/** An Image API info.json (not a Manifest). */
export const isImageInfoJson = (json: unknown): boolean => {
  if (!isObj(json) || json.type === 'Manifest' || json.type === 'Collection') return false;
  if (/sc:(Manifest|Collection)/.test(String(json['@type'] ?? ''))) return false;
  return /iiif\.io\/api\/image/.test(`${text(json['@context'])} ${text(json.protocol)} ${text(json.profile)}`);
};

/** The two sides of a Choice of one Canvas (undefined while the Canvas size is not known). */
export const choiceSidesOf = (
  images: CanvasImages,
  choice: CanvasPainting,
  pick: [number, number],
): [CompareSide, CompareSide] | undefined => {
  const { width, height } = images;
  if (!width || !height) return undefined;
  const paintings = images.paintings.filter(paintsImage);
  const side = (i: 0 | 1): CompareSide => ({
    layers: chosenLayersOf(paintings, (p) => (p.id === choice.id ? pick[i] : 0)),
    width,
    height,
  });
  return [side(0), side(1)];
};

/** The candidate of an info.json: one layer that is the whole image. `url` is where it was read. */
export const infoCandidateOf = (json: unknown, url: string): CompareCandidate | null => {
  const info = parseImageInfo(json);
  if (!info) return null;
  const j = (isObj(json) ? json : {}) as Json;
  const id = String(j.id ?? j['@id'] ?? url.replace(/\/info\.json(\?.*)?$/, '')).replace(/\/+$/, '');
  const parts = id.split('/').filter(Boolean);
  const label = decodeURIComponent(parts[parts.length - 1] ?? id);
  const layer: ImageLayer = {
    url: `${id}/full/max/0/default.jpg`,
    service: { id, version: info.version },
    width: info.width,
    height: info.height,
    rotation: 0,
    mirror: false,
    annotations: [],
  };
  return { label, side: { layers: [layer], width: info.width, height: info.height } };
};

/**
 * The candidates of a Manifest (as Presentation 3): every Canvas that paints an image, with the
 * first candidate of each painting. With more than one Canvas the name is "<Manifest> — <Canvas>".
 */
export const candidatesOfManifest = (raw: unknown, locale: string, fallbackLabel = ''): CompareCandidate[] => {
  const canvases = manifestItemsOf(raw);
  const manifestLabel = (isObj(raw) ? labelIn(raw.label, locale) : '') || fallbackLabel;
  const out: CompareCandidate[] = [];
  canvases.forEach((canvas, i) => {
    const images = canvasImagesOf(canvas);
    const layers = chosenLayersOf(images.paintings.filter(paintsImage), () => 0);
    if (layers.length === 0 || !images.width || !images.height) return;
    const own = labelIn(canvas.label, locale) || String(i + 1);
    out.push({
      label: canvases.length > 1 ? `${manifestLabel} — ${own}` : manifestLabel || own,
      side: { layers, width: images.width, height: images.height },
    });
  });
  return out;
};

/** Is this (Presentation 3) JSON a Collection? */
export const isCollectionJson = (raw: unknown): boolean => isObj(raw) && raw.type === 'Collection';

/** The URLs of the Manifests listed in a Collection (nested Collections are left out). */
export const memberManifestUrlsOf = (raw: unknown): string[] =>
  collectionEntriesOf(raw)
    .filter((e) => e.type === 'Manifest')
    .map((e) => e.id);

/**
 * B put into the frame of A, keeping its aspect ratio, fitted and centred (the layers' target
 * rectangles are scaled from B's Canvas into A's units). The same size: B as it is.
 */
export const fitSide = (side: CompareSide, frame: { width: number; height: number }): CompareSide => {
  if (side.width === frame.width && side.height === frame.height) return side;
  const k = Math.min(frame.width / side.width, frame.height / side.height);
  const ox = (frame.width - side.width * k) / 2;
  const oy = (frame.height - side.height * k) / 2;
  const layers = side.layers.map((l) => {
    const t = l.target ?? { x: 0, y: 0, w: side.width, h: side.height };
    return { ...l, target: { x: ox + t.x * k, y: oy + t.y * k, w: t.w * k, h: t.h * k } };
  });
  return { layers, width: frame.width, height: frame.height };
};

/** Width of the sharper of the two sides, in the frame's units (it decides how far one can zoom in). */
export const compareDetailWidthOf = (a: CompareSide, b: CompareSide): number | undefined => {
  const inFrame = (l: ImageLayer) => ((l.width ?? 0) * a.width) / (l.target?.w ?? a.width);
  return Math.max(0, detailWidthOf(a.layers) ?? 0, ...b.layers.map(inFrame)) || undefined;
};
