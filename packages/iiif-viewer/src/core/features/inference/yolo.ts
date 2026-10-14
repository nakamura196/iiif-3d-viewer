// YOLO（Ultralytics）の検出モデルの、入力の置き方と出力の読み方。DOM に依存しない（縮めて置くのは呼ぶ側が OffscreenCanvas で行う）。
// 出力は [1, 4 + クラス数, N]（中心 x・中心 y・幅・高さ、続けてクラスごとの確からしさ）。座標は正方形の入力の画素。
// face-web（中村 覚）の src/lib/ort-yolo.ts・sahi.ts を写した。

/** Where a part of the image sits in the square model input (centred, grey around it as Ultralytics does). */
export interface YoloPlacement {
  /** Part of the image, in image pixels. */
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  /** Input pixels per image pixel. */
  scale: number;
  padLeft: number;
  padTop: number;
}

/** Places the part (sx, sy, sw, sh) of an image centred in a size x size input. */
export const yoloPlace = (sx: number, sy: number, sw: number, sh: number, size: number): YoloPlacement => {
  const scale = size / Math.max(sw, sh);
  return {
    sx,
    sy,
    sw,
    sh,
    scale,
    padLeft: Math.floor((size - Math.round(sw * scale)) / 2),
    padTop: Math.floor((size - Math.round(sh * scale)) / 2),
  };
};

/**
 * The whole image, then size x size tiles that overlap by `overlap` (SAHI). Small things (faces in a crowd) are
 * missed when the whole image is shrunk to the input, and found on the tiles. An image no larger than one tile gets
 * the whole image only.
 */
export const yoloTiles = (w: number, h: number, size: number, overlap = 0.2): YoloPlacement[] => {
  const out = [yoloPlace(0, 0, w, h, size)];
  if (w <= size && h <= size) return out;
  const starts = (total: number) => {
    if (total <= size) return [0];
    const step = Math.max(1, Math.round(size * (1 - overlap)));
    const s: number[] = [];
    for (let v = 0; v + size < total; v += step) s.push(v);
    s.push(total - size);
    return [...new Set(s)];
  };
  for (const y of starts(h))
    for (const x of starts(w)) out.push(yoloPlace(x, y, Math.min(size, w - x), Math.min(size, h - y), size));
  return out;
};

/** RGBA pixels of the square input to an NCHW tensor, 0..1 in RGB order. */
export const yoloTensor = (px: Uint8ClampedArray, size: number): Float32Array => {
  const plane = size * size;
  const x = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) for (let k = 0; k < 3; k++) x[k * plane + i] = px[i * 4 + k] / 255;
  return x;
};

/**
 * Boxes above `scoreMin` in one output [1, 4 + classes, n], put back into image pixels. Each box takes its most
 * likely class. Pushes x1, y1, x2, y2 to `boxes`, and the score and class to `scores` and `classes`.
 */
export const yoloDecode = (
  data: ArrayLike<number>,
  channels: number,
  n: number,
  at: YoloPlacement,
  scoreMin: number,
  boxes: number[],
  scores: number[],
  classes: number[],
): void => {
  for (let i = 0; i < n; i++) {
    let best = 0;
    let score = -1;
    for (let c = 4; c < channels; c++) {
      const v = data[c * n + i];
      if (v > score) [score, best] = [v, c - 4];
    }
    if (score <= scoreMin) continue;
    const cx = data[i];
    const cy = data[n + i];
    const w = data[2 * n + i];
    const h = data[3 * n + i];
    const back = (v: number, pad: number, origin: number, limit: number) =>
      Math.min(Math.max((v - pad) / at.scale + origin, 0), limit);
    boxes.push(
      back(cx - w / 2, at.padLeft, at.sx, at.sx + at.sw),
      back(cy - h / 2, at.padTop, at.sy, at.sy + at.sh),
      back(cx + w / 2, at.padLeft, at.sx, at.sx + at.sw),
      back(cy + h / 2, at.padTop, at.sy, at.sy + at.sh),
    );
    scores.push(score);
    classes.push(best);
  }
};
