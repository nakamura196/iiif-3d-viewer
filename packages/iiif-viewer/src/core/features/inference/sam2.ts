// SAM 2.1（Segment Anything 2.1。枠や点を渡すと、その物の範囲を塗って返すモデル）の、入力の置き方と出力の読み方。
// DOM に依存しない（切り出して 1,024 角に引き伸ばすのは呼ぶ側が OffscreenCanvas で行う）。
// 前処理は onnx-community/sam2.1-hiera-tiny-ONNX の preprocessor_config.json と同じ: 縦横比を保たずに 1,024 角へ、
// ImageNet の平均と標準偏差で正規化。出力のマスクは 256 角で、入力の 1,024 角全体に対応する（0 より大きければ内側）。
import { maskToPolygon, type XY } from './contour';

export const SAM2_SIZE = 1024;
export const SAM2_MASK = 256;

const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

export interface Sam2Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * The part of the image to give SAM for one box: a square around it, `context` times its longer side (at least
 * `min` pixels), cut at the image edges. Small things (a face of 40 px) are lost when the whole image is shrunk to
 * 1,024, so each box gets its own part.
 */
export const sam2Crop = (b: Sam2Box, w: number, h: number, context = 2.5, min = 160): Sam2Box => {
  const cx = (b.x0 + b.x1) / 2;
  const cy = (b.y0 + b.y1) / 2;
  const s = Math.max(Math.max(b.x1 - b.x0, b.y1 - b.y0) * context, min);
  return {
    x0: Math.max(0, Math.round(cx - s / 2)),
    y0: Math.max(0, Math.round(cy - s / 2)),
    x1: Math.min(w, Math.round(cx + s / 2)),
    y1: Math.min(h, Math.round(cy + s / 2)),
  };
};

/** RGBA pixels of the 1,024-square input to a normalized NCHW tensor. */
export const sam2Tensor = (px: Uint8ClampedArray, size = SAM2_SIZE): Float32Array => {
  const plane = size * size;
  const x = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) for (let k = 0; k < 3; k++) x[k * plane + i] = (px[i * 4 + k] / 255 - MEAN[k]) / STD[k];
  return x;
};

/** A box in image pixels, as SAM input coordinates of the crop (stretched to 1,024 square). */
export const sam2BoxInput = (b: Sam2Box, crop: Sam2Box): number[] => {
  const sx = SAM2_SIZE / (crop.x1 - crop.x0);
  const sy = SAM2_SIZE / (crop.y1 - crop.y0);
  return [(b.x0 - crop.x0) * sx, (b.y0 - crop.y0) * sy, (b.x1 - crop.x0) * sx, (b.y1 - crop.y0) * sy];
};

/**
 * One 256-square mask (logits) scaled to the crop's pixels (bilinear, pixel centres as cv2 / PyTorch with
 * align_corners=false), then inside = logit > 0.
 */
export const sam2MaskToCrop = (logits: ArrayLike<number>, cw: number, ch: number, m = SAM2_MASK): Uint8Array => {
  const out = new Uint8Array(cw * ch);
  const fx = m / cw;
  const fy = m / ch;
  for (let y = 0; y < ch; y++) {
    const v = Math.min(m - 1, Math.max(0, (y + 0.5) * fy - 0.5));
    const y0 = Math.floor(v);
    const y1 = Math.min(m - 1, y0 + 1);
    const ty = v - y0;
    for (let x = 0; x < cw; x++) {
      const u = Math.min(m - 1, Math.max(0, (x + 0.5) * fx - 0.5));
      const x0 = Math.floor(u);
      const x1 = Math.min(m - 1, x0 + 1);
      const tx = u - x0;
      const a = logits[y0 * m + x0] * (1 - tx) + logits[y0 * m + x1] * tx;
      const b = logits[y1 * m + x0] * (1 - tx) + logits[y1 * m + x1] * tx;
      out[y * cw + x] = a * (1 - ty) + b * ty > 0 ? 1 : 0;
    }
  }
  return out;
};

/**
 * The outline for one box from the decoder's output: of its 3 masks, the one with the best predicted IoU, as a
 * polygon in image pixels. `masks` holds the 3 masks of this box one after another.
 */
export const sam2Outline = (masks: ArrayLike<number>, iou: ArrayLike<number>, crop: Sam2Box, eps = 1): XY[] | null => {
  let k = 0;
  for (let i = 1; i < 3; i++) if (iou[i] > iou[k]) k = i;
  const plane = SAM2_MASK * SAM2_MASK;
  const one = Array.prototype.slice.call(masks, k * plane, (k + 1) * plane) as number[];
  const cw = crop.x1 - crop.x0;
  const ch = crop.y1 - crop.y0;
  const poly = maskToPolygon(sam2MaskToCrop(one, cw, ch), cw, ch, eps);
  return poly ? poly.map(([x, y]) => [x + crop.x0, y + crop.y0] as XY) : null;
};
