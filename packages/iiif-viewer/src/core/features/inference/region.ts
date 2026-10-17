// 画像の一部（表示中の範囲など）だけを推論にかけるための計算。Canvas 上の範囲を画像の画素の範囲に直し、
// 静的タイル（level 0）しか無いときは、その範囲にかかるタイルを、モデルに合う縮尺で選ぶ。
import { tilesCovering, type ImageInfo, type ImageRegion, type ImageServiceRef, type Tile } from '../image';
import type { ImageToCanvas } from './annotationPage';

/**
 * The pixels of an image (`imageWidth` x `imageHeight`, painted on `target` of the Canvas) under `box` (Canvas
 * coordinates), widened to whole pixels and clamped to the image. Null when the box misses the image.
 */
export const imageRegionOfBox = (
  box: ImageRegion,
  target: ImageRegion,
  imageWidth: number,
  imageHeight: number,
): ImageRegion | null => {
  const kx = imageWidth / target.w;
  const ky = imageHeight / target.h;
  const x0 = Math.max(0, Math.floor((box.x - target.x) * kx));
  const y0 = Math.max(0, Math.floor((box.y - target.y) * ky));
  const x1 = Math.min(imageWidth, Math.ceil((box.x + box.w - target.x) * kx));
  const y1 = Math.min(imageHeight, Math.ceil((box.y + box.h - target.y) * ky));
  if (x1 - x0 < 1 || y1 - y0 < 1) return null;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
};

/** How a pixel of `region` (of the image), given to the model at `outWidth` x `outHeight`, maps to the Canvas. */
export const regionToCanvasOf = (
  region: ImageRegion,
  target: ImageRegion,
  imageWidth: number,
  imageHeight: number,
  outWidth: number,
  outHeight: number,
): ImageToCanvas => {
  const kx = target.w / imageWidth;
  const ky = target.h / imageHeight;
  return {
    x: target.x + region.x * kx,
    y: target.y + region.y * ky,
    scaleX: (region.w * kx) / outWidth,
    scaleY: (region.h * ky) / outHeight,
  };
};

/**
 * The tiles to put together for `region` (source pixels) so that its long side is about `longSide`: the coarsest
 * scale factor that still gives at least `longSide` pixels (or the finest there is), made coarser while that takes
 * more than `limit` tiles. Null when even the coarsest takes more than `limit`.
 */
export const tilesForRegion = (
  service: ImageServiceRef,
  info: ImageInfo,
  scheme: { width: number; height: number; scaleFactors: number[] },
  region: ImageRegion,
  longSide: number,
  limit = 64,
): { scaleFactor: number; tiles: Tile[] } | null => {
  const factors = [...scheme.scaleFactors].sort((a, b) => a - b);
  const want = Math.max(region.w, region.h) / longSide;
  let start = 0;
  for (let i = 0; i < factors.length; i++) if (factors[i] <= want) start = i;
  for (let i = start; i < factors.length; i++) {
    const tiles = tilesCovering(service, info, scheme, factors[i], region, limit + 1);
    if (tiles.length <= limit) return { scaleFactor: factors[i], tiles };
  }
  return null;
};
