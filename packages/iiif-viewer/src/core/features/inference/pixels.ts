// 画素（RGBA の並び）からモデルの入力を作る。DOM に依存しない（切り出しは呼ぶ側が OffscreenCanvas で行う）。
// 縮め方は PIL の Image.resize（BICUBIC）と同じにする。canvas の縮め方では、NDL の OCR で読みや検出が変わった
// （docviz の docs/notes/demo.md）。docviz（中村 覚）の src/parseq.ts から写した。

/**
 * One direction of PIL's BICUBIC resize (a = -0.5), rounding to 8 bits like PIL. Apply it across, then down.
 * When shrinking, it mixes a range as wide as the shrink factor (as PIL does).
 */
export function resizeAxis(src: Uint8ClampedArray, w: number, h: number, outSize: number, horizontal: boolean): Uint8ClampedArray {
  const inSize = horizontal ? w : h;
  const scale = inSize / outSize;
  const fs = Math.max(scale, 1);
  const support = 2 * fs;
  const cubic = (x: number) => {
    const a = -0.5;
    x = Math.abs(x);
    if (x < 1) return ((a + 2) * x - (a + 3)) * x * x + 1;
    if (x < 2) return (((x - 5) * x + 8) * x - 4) * a;
    return 0;
  };
  const W2 = horizontal ? outSize : w;
  const H2 = horizontal ? h : outSize;
  const out = new Uint8ClampedArray(W2 * H2 * 4);
  for (let o = 0; o < outSize; o++) {
    const center = (o + 0.5) * scale;
    const lo = Math.max(Math.trunc(center - support + 0.5), 0);
    const hi = Math.min(Math.trunc(center + support + 0.5), inSize);
    const ws: number[] = [];
    let sum = 0;
    for (let i = lo; i < hi; i++) {
      const v = cubic((i - center + 0.5) / fs);
      ws.push(v);
      sum += v;
    }
    for (let k = 0; k < ws.length; k++) ws[k] /= sum;
    const n = horizontal ? h : w;
    for (let j = 0; j < n; j++)
      for (let c = 0; c < 3; c++) {
        let acc = 0;
        for (let k = 0; k < ws.length; k++) {
          const i = lo + k;
          acc += ws[k] * src[(horizontal ? j * w + i : i * w + j) * 4 + c];
        }
        out[(horizontal ? j * W2 + o : o * W2 + j) * 4 + c] = Math.round(acc);
      }
  }
  return out;
}

/** Resizes RGBA pixels to outW x outH (across, then down). */
export const resizeRgba = (px: Uint8ClampedArray, w: number, h: number, outW: number, outH: number): Uint8ClampedArray => {
  let out = px;
  if (w !== outW) out = resizeAxis(out, w, h, outW, true);
  if (h !== outH) out = resizeAxis(out, outW, h, outH, false);
  return out;
};

/** Turns RGBA pixels 90 degrees to the left (PIL ROTATE_90): (x, y) goes to (y, w - 1 - x). */
export const rotateLeft = (px: Uint8ClampedArray, w: number, h: number): Uint8ClampedArray => {
  const r = new Uint8ClampedArray(px.length);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const s = (y * w + x) * 4;
      const d = ((w - 1 - x) * h + y) * 4;
      r[d] = px[s];
      r[d + 1] = px[s + 1];
      r[d + 2] = px[s + 2];
      r[d + 3] = px[s + 3];
    }
  return r;
};

/** NCHW float tensor in BGR order: (value - mean[k]) / std[k], with mean and std given in BGR order. */
export const bgrTensor = (px: Uint8ClampedArray, w: number, h: number, mean: number[], std: number[]): Float32Array => {
  const plane = w * h;
  const x = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) for (let k = 0; k < 3; k++) x[k * plane + i] = (px[i * 4 + 2 - k] - mean[k]) / std[k];
  return x;
};

/**
 * OpenCV's cv2.resize(INTER_LINEAR) on 8-bit pixels, bit for bit (NDLOCR-Lite's parseq.py uses it, not PIL).
 * Fixed point as in OpenCV: weights in 1/2048, the vertical pass as its SIMD code rounds
 * (((a >> 4) * b0 >> 16) + ((c >> 4) * b1 >> 16) + 2) >> 2. Across, the source index is clamped to the edge with the
 * weight set to 0; down, only the row index is clamped. Checked against cv2 4.13 (arm64) on 300 random crops.
 */
export const resizeLinearCv = (px: Uint8ClampedArray, w: number, h: number, outW: number, outH: number): Uint8ClampedArray => {
  if (w === outW && h === outH) return px;
  const taps = (src: number, dst: number, clamp: boolean) => {
    const scale = 1 / (dst / src);
    const i0 = new Int32Array(dst);
    const i1 = new Int32Array(dst);
    const a0 = new Int32Array(dst);
    const a1 = new Int32Array(dst);
    for (let d = 0; d < dst; d++) {
      let f = Math.fround((d + 0.5) * scale - 0.5);
      let s = Math.floor(f);
      f = Math.fround(f - s);
      if (clamp && s < 0) [s, f] = [0, 0];
      if (clamp && s >= src - 1) [s, f] = [src - 1, 0];
      i0[d] = Math.min(Math.max(s, 0), src - 1);
      i1[d] = Math.min(Math.max(s + 1, 0), src - 1);
      // saturate_cast<short>(v * 2048) rounds to nearest even
      const r = (v: number) => {
        const x = Math.fround(v) * 2048;
        const n = Math.round(x);
        return n - x === 0.5 && n % 2 ? n - 1 : n;
      };
      a0[d] = r(Math.fround(1 - f));
      a1[d] = r(f);
    }
    return { i0, i1, a0, a1 };
  };
  const X = taps(w, outW, true);
  const Y = taps(h, outH, false);
  const rows = new Int32Array(h * outW * 3);
  for (let y = 0; y < h; y++)
    for (let d = 0; d < outW; d++)
      for (let c = 0; c < 3; c++)
        rows[(y * outW + d) * 3 + c] = px[(y * w + X.i0[d]) * 4 + c] * X.a0[d] + px[(y * w + X.i1[d]) * 4 + c] * X.a1[d];
  const out = new Uint8ClampedArray(outW * outH * 4);
  for (let d = 0; d < outH; d++) {
    const r0 = Y.i0[d] * outW * 3;
    const r1 = Y.i1[d] * outW * 3;
    const b0 = Y.a0[d];
    const b1 = Y.a1[d];
    for (let k = 0; k < outW * 3; k++) {
      const v = (((rows[r0 + k] >> 4) * b0) >> 16) + (((rows[r1 + k] >> 4) * b1) >> 16);
      out[(d * outW + Math.trunc(k / 3)) * 4 + (k % 3)] = (v + 2) >> 2;
    }
    for (let x = 0; x < outW; x++) out[(d * outW + x) * 4 + 3] = 255;
  }
  return out;
};

/** NCHW float tensor in RGB order: (value / 255 - mean[k]) / std[k]. */
export const rgbTensor = (px: Uint8ClampedArray, w: number, h: number, mean: number[], std: number[]): Float32Array => {
  const plane = w * h;
  const x = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) for (let k = 0; k < 3; k++) x[k * plane + i] = (px[i * 4 + k] / 255 - mean[k]) / std[k];
  return x;
};
