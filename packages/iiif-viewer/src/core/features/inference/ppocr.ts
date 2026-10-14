// PaddleOCR（PP-OCRv5）の文字の検出（DB）と読み取り（CTC）。DOM に依存しない。
// 公式の PaddleOCR 3.x（paddlex の OCR パイプライン）の手順を写した: DetResizeForTest（limit_type min）→ DBPostProcess
// （thresh 0.3・box_thresh 0.6・unclip 1.5・四角形）→ SortQuadBoxes → CropByPolys（最小外接矩形で切り出し、縦長は左へ回す）
// → OCRReisizeNormImg（高さ 48）→ CTCLabelDecode。
// 公式との違い: 輪郭（cv2.findContours）の代わりに、つながった画素のかたまりを取る（最小外接矩形は同じになる）。
// 広げる処理（pyclipper の丸い offset）は、四角形を各辺 d だけ広げた四角形として計算する（その最小外接矩形と同じ）。
// 切り出しの補間は OpenCV の INTER_CUBIC と同じ係数（a = -0.75）。
import { bgrTensor, resizeLinearCv, rotateLeft } from './pixels';

export const PPOCR = {
  /** Probability above which a pixel is text. */
  thresh: 0.3,
  /** Mean probability inside a box below which the box is dropped. */
  boxThresh: 0.6,
  unclipRatio: 1.5,
  minSize: 3,
  maxCandidates: 1000,
  /** Detection input: the shorter side is raised to this, the longer side capped (`limit_type: min`). */
  detMinSide: 64,
  detMaxSide: 4000,
  recH: 48,
  recMinW: 320,
  recMaxW: 3200,
} as const;

type XY = [number, number];

/** Detection input size: multiples of 32 (as DetResizeForTest, `limit_type: min`). */
export const ppocrDetSize = (w: number, h: number): [number, number] => {
  let ratio = Math.min(w, h) < PPOCR.detMinSide ? PPOCR.detMinSide / Math.min(w, h) : 1;
  if (Math.max(w, h) * ratio > PPOCR.detMaxSide) ratio = PPOCR.detMaxSide / Math.max(w, h);
  const r32 = (n: number) => Math.max(Math.round(Math.trunc(n * ratio) / 32) * 32, 32);
  return [r32(w), r32(h)];
};

/** Detection tensor (NCHW, BGR, ImageNet mean/std on 0..255). `px` is already dw x dh. */
export const ppocrDetTensor = (px: Uint8ClampedArray, w: number, h: number): Float32Array =>
  bgrTensor(px, w, h, [0.485 * 255, 0.456 * 255, 0.406 * 255], [0.229 * 255, 0.224 * 255, 0.225 * 255]);

const cross = (o: XY, a: XY, b: XY) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

/** Convex hull (Andrew's monotone chain), counter-clockwise in y-down pixels. */
const convexHull = (pts: XY[]): XY[] => {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const lower: XY[] = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper: XY[] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
};

interface Rect {
  cx: number;
  cy: number;
  /** Side lengths, along (ux, uy) and across it. */
  w: number;
  h: number;
  ux: number;
  uy: number;
}

/** Minimum-area rectangle around points (as cv2.minAreaRect): one side lies on an edge of the hull. */
const minAreaRect = (pts: XY[]): Rect => {
  const hull = convexHull(pts);
  // 1 画素だけのかたまり（頂点がすべて同じ点）は、大きさ 0
  let best: Rect = { cx: hull[0][0], cy: hull[0][1], w: 0, h: 0, ux: 1, uy: 0 };
  let bestArea = Infinity;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i];
    const b = hull[(i + 1) % hull.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (!len) continue;
    const ux = (b[0] - a[0]) / len;
    const uy = (b[1] - a[1]) / len;
    let minU = Infinity;
    let maxU = -Infinity;
    let minV = Infinity;
    let maxV = -Infinity;
    for (const q of hull) {
      const u = q[0] * ux + q[1] * uy;
      const v = -q[0] * uy + q[1] * ux;
      if (u < minU) minU = u;
      if (u > maxU) maxU = u;
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
    }
    const area = (maxU - minU) * (maxV - minV);
    if (area < bestArea) {
      bestArea = area;
      const cu = (minU + maxU) / 2;
      const cv = (minV + maxV) / 2;
      best = { cx: cu * ux - cv * uy, cy: cu * uy + cv * ux, w: maxU - minU, h: maxV - minV, ux, uy };
    }
  }
  return best;
};

/** Corners of a rectangle in the order of get_mini_boxes: top-left, top-right, bottom-right, bottom-left. */
const rectCorners = (r: Rect): XY[] => {
  const ax = (r.ux * r.w) / 2;
  const ay = (r.uy * r.w) / 2;
  const bx = (-r.uy * r.h) / 2;
  const by = (r.ux * r.h) / 2;
  const p: XY[] = [
    [r.cx - ax - bx, r.cy - ay - by],
    [r.cx + ax - bx, r.cy + ay - by],
    [r.cx + ax + bx, r.cy + ay + by],
    [r.cx - ax + bx, r.cy - ay + by],
  ].sort((a, b) => a[0] - b[0]) as XY[];
  const [tl, bl] = p[1][1] > p[0][1] ? [p[0], p[1]] : [p[1], p[0]];
  const [tr, br] = p[3][1] > p[2][1] ? [p[2], p[3]] : [p[3], p[2]];
  return [tl, tr, br, bl];
};

/** Mean probability inside the box (box_score_fast: the box filled on its bounding rows and columns). */
const boxScore = (prob: Float32Array, w: number, h: number, box: XY[]): number => {
  const xs = box.map((p) => p[0]);
  const ys = box.map((p) => p[1]);
  const clip = (n: number, hi: number) => Math.min(Math.max(n, 0), hi);
  const x0 = clip(Math.floor(Math.min(...xs)), w - 1);
  const x1 = clip(Math.ceil(Math.max(...xs)), w - 1);
  const y0 = clip(Math.floor(Math.min(...ys)), h - 1);
  const y1 = clip(Math.ceil(Math.max(...ys)), h - 1);
  // fillPoly は頂点を整数に切り捨てて塗る
  const q = box.map(([x, y]) => [Math.trunc(x - x0) + x0, Math.trunc(y - y0) + y0] as XY);
  // 向きをそろえる（どちら回りでも内側を正にする）
  const sign = cross(q[0], q[1], q[2]) < 0 ? -1 : 1;
  let sum = 0;
  let n = 0;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      let inside = true;
      for (let k = 0; k < 4 && inside; k++) if (sign * cross(q[k], q[(k + 1) % 4], [x, y]) < 0) inside = false;
      if (inside) {
        sum += prob[y * w + x];
        n++;
      }
    }
  return n ? sum / n : 0;
};

export interface PpocrBox {
  /** Corners in image pixels: top-left, top-right, bottom-right, bottom-left (integers, as the original). */
  quad: XY[];
  score: number;
}

/**
 * Text boxes from the probability map (dw x dh) of the detector, in image pixels (W x H), in reading order
 * (top to bottom, then left to right on the same line, as SortQuadBoxes).
 */
export const ppocrBoxes = (prob: Float32Array, dw: number, dh: number, W: number, H: number): PpocrBox[] => {
  const label = new Int32Array(dw * dh);
  const out: PpocrBox[] = [];
  const stack: number[] = [];
  let parts = 0;
  for (let i = 0; i < dw * dh && parts < PPOCR.maxCandidates; i++) {
    if (prob[i] <= PPOCR.thresh || label[i]) continue;
    parts++;
    // つながった画素（8 近傍）の、行ごとの左端と右端（凸包を作るにはそれで足りる）
    const rows = new Map<number, [number, number]>();
    label[i] = parts;
    stack.push(i);
    while (stack.length) {
      const p = stack.pop()!;
      const x = p % dw;
      const y = (p - x) / dw;
      const r = rows.get(y);
      if (!r) rows.set(y, [x, x]);
      else {
        if (x < r[0]) r[0] = x;
        if (x > r[1]) r[1] = x;
      }
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= dw || ny >= dh) continue;
          const q = ny * dw + nx;
          if (prob[q] > PPOCR.thresh && !label[q]) {
            label[q] = parts;
            stack.push(q);
          }
        }
    }
    const pts: XY[] = [];
    for (const [y, [a, b]] of rows) pts.push([a, y], [b, y]);
    const rect = minAreaRect(pts);
    if (Math.min(rect.w, rect.h) < PPOCR.minSize) continue;
    const score = boxScore(prob, dw, dh, rectCorners(rect));
    if (score < PPOCR.boxThresh) continue;
    // 広げる幅は、面積 × 1.5 ÷ 周囲の長さ
    const d = (rect.w * rect.h * PPOCR.unclipRatio) / (2 * (rect.w + rect.h));
    const big = { ...rect, w: rect.w + 2 * d, h: rect.h + 2 * d };
    if (Math.min(big.w, big.h) < PPOCR.minSize + 2) continue;
    const quad = rectCorners(big).map(
      ([x, y]) => [Math.min(Math.max(Math.round((x / dw) * W), 0), W), Math.min(Math.max(Math.round((y / dh) * H), 0), H)] as XY,
    );
    out.push({ quad, score });
  }
  // 上から下へ。左上の y の差が 10px 未満なら、左から右へ
  out.sort((a, b) => a.quad[0][1] - b.quad[0][1] || a.quad[0][0] - b.quad[0][0]);
  for (let i = 0; i < out.length - 1; i++)
    for (let j = i; j >= 0; j--) {
      if (Math.abs(out[j + 1].quad[0][1] - out[j].quad[0][1]) < 10 && out[j + 1].quad[0][0] < out[j].quad[0][0]) {
        [out[j], out[j + 1]] = [out[j + 1], out[j]];
      } else break;
    }
  return out;
};

const cubicWeights = (t: number): [number, number, number, number] => {
  const a = -0.75;
  const w0 = ((a * (t + 1) - 5 * a) * (t + 1) + 8 * a) * (t + 1) - 4 * a;
  const w1 = ((a + 2) * t - (a + 3)) * t * t + 1;
  const w2 = ((a + 2) * (1 - t) - (a + 3)) * (1 - t) * (1 - t) + 1;
  return [w0, w1, w2, 1 - w0 - w1 - w2];
};

/**
 * The line inside `quad` cut out straight (get_rotate_crop_image: the quad mapped onto a w x h rectangle, edges
 * repeated, bicubic). A line at least 1.5 times taller than wide is turned to the left (vertical text).
 */
export const ppocrCrop = (px: Uint8ClampedArray, W: number, H: number, quad: XY[]): { px: Uint8ClampedArray; w: number; h: number } => {
  // 公式（get_minarea_rect_crop）と同じく、整数にした四隅の最小外接矩形を取り直してから切り出す
  const [p0, p1, p2, p3] = rectCorners(minAreaRect(quad));
  const dist = (a: XY, b: XY) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const w = Math.trunc(Math.max(dist(p0, p1), dist(p2, p3)));
  const h = Math.trunc(Math.max(dist(p0, p3), dist(p1, p2)));
  if (w <= 0 || h <= 0) return { px: new Uint8ClampedArray(0), w: 0, h: 0 };
  const out = new Uint8ClampedArray(w * h * 4);
  const ax = (p1[0] - p0[0]) / w;
  const ay = (p1[1] - p0[1]) / w;
  const bx = (p3[0] - p0[0]) / h;
  const by = (p3[1] - p0[1]) / h;
  const at = (x: number, y: number) => (Math.min(Math.max(y, 0), H - 1) * W + Math.min(Math.max(x, 0), W - 1)) * 4;
  for (let v = 0; v < h; v++)
    for (let u = 0; u < w; u++) {
      const sx = p0[0] + u * ax + v * bx;
      const sy = p0[1] + u * ay + v * by;
      const ix = Math.floor(sx);
      const iy = Math.floor(sy);
      const wx = cubicWeights(sx - ix);
      const wy = cubicWeights(sy - iy);
      const o = (v * w + u) * 4;
      for (let c = 0; c < 3; c++) {
        let acc = 0;
        for (let j = 0; j < 4; j++) {
          let row = 0;
          for (let i = 0; i < 4; i++) row += wx[i] * px[at(ix - 1 + i, iy - 1 + j) + c];
          acc += wy[j] * row;
        }
        out[o + c] = Math.round(acc);
      }
      out[o + 3] = 255;
    }
  if (h / w >= 1.5) return { px: rotateLeft(out, w, h), w: h, h: w };
  return { px: out, w, h };
};

/** Recognition tensor: height 48, width kept in proportion (at least 320, zeros on the right). */
export const ppocrRecTensor = (px: Uint8ClampedArray, w: number, h: number): { data: Float32Array; width: number } => {
  const H48 = PPOCR.recH;
  const ratio = w / h;
  let width = Math.trunc(H48 * Math.max(PPOCR.recMinW / H48, ratio));
  let rw: number;
  if (width > PPOCR.recMaxW) rw = width = PPOCR.recMaxW;
  else rw = Math.min(Math.ceil(H48 * ratio), width);
  const small = resizeLinearCv(px, w, h, rw, H48);
  const t = bgrTensor(small, rw, H48, [127.5, 127.5, 127.5], [127.5, 127.5, 127.5]);
  const data = new Float32Array(3 * H48 * width);
  for (let c = 0; c < 3; c++)
    for (let y = 0; y < H48; y++) data.set(t.subarray((c * H48 + y) * rw, (c * H48 + y + 1) * rw), (c * H48 + y) * width);
  return { data, width };
};

/**
 * CTC greedy decoding of [T, C] probabilities: the best class per step, repeats merged, blanks (0) dropped. `chars`
 * is the dictionary without the blank (index k + 1 is chars[k]); the last class is a space. Score: mean of the kept
 * steps' probabilities.
 */
export const decodeCtc = (prob: Float32Array, T: number, C: number, chars: string[]): { text: string; score: number } => {
  let text = '';
  let sum = 0;
  let n = 0;
  let prev = -1;
  for (let t = 0; t < T; t++) {
    let best = 0;
    let bp = -Infinity;
    for (let c = 0; c < C; c++) {
      const v = prob[t * C + c];
      if (v > bp) {
        bp = v;
        best = c;
      }
    }
    if (best !== 0 && best !== prev) {
      text += best - 1 < chars.length ? chars[best - 1] : ' ';
      sum += bp;
      n++;
    }
    prev = best;
  }
  return { text, score: n ? sum / n : 0 };
};

/** Axis-aligned box of a quad, and the quad itself when it is turned (more than half a pixel off the axes). */
export const ppocrQuadBox = (quad: XY[]): { x: number; y: number; w: number; h: number; polygon?: XY[] } => {
  const xs = quad.map((p) => p[0]);
  const ys = quad.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  const turned = Math.abs(quad[0][1] - quad[1][1]) > 0.5 || Math.abs(quad[0][0] - quad[3][0]) > 0.5;
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y, ...(turned ? { polygon: quad.map((p) => [p[0], p[1]] as XY) } : {}) };
};

export interface PpocrLine {
  x: number;
  y: number;
  w: number;
  h: number;
  polygon?: XY[];
  /** Mean of the detection probability inside the box. */
  score: number;
  text: string;
  /** Mean of the recognition probability of the characters read. */
  textScore: number;
}

/** How to run the two models (the caller owns the sessions). */
export interface PpocrRunners {
  /** Probability map (dh x dw) for a detection tensor [1, 3, dh, dw]. */
  detect(input: Float32Array, dw: number, dh: number): Promise<Float32Array>;
  /** Probabilities [T, C] for a recognition tensor [1, 3, 48, width]. */
  recognize(input: Float32Array, width: number): Promise<{ data: Float32Array; T: number; C: number }>;
  progress(stage: 'detect' | 'read', done: number, total: number): void;
}

/** The whole PP-OCR pipeline on RGBA pixels (W x H): lines in reading order, with the text read. */
export const ppocrRead = async (page: Uint8ClampedArray, W: number, H: number, chars: string[], run: PpocrRunners): Promise<PpocrLine[]> => {
  run.progress('detect', 0, 1);
  const [dw, dh] = ppocrDetSize(W, H);
  const prob = await run.detect(ppocrDetTensor(resizeLinearCv(page, W, H, dw, dh), dw, dh), dw, dh);
  const boxes = ppocrBoxes(prob, dw, dh, W, H);
  run.progress('detect', 1, 1);
  const lines: PpocrLine[] = [];
  for (let i = 0; i < boxes.length; i++) {
    run.progress('read', i, boxes.length);
    const { quad, score } = boxes[i];
    const crop = ppocrCrop(page, W, H, quad);
    if (!crop.w || !crop.h) continue;
    const t = ppocrRecTensor(crop.px, crop.w, crop.h);
    const r = await run.recognize(t.data, t.width);
    const { text, score: textScore } = decodeCtc(r.data, r.T, r.C, chars);
    if (text.trim()) lines.push({ ...ppocrQuadBox(quad), score, text, textScore });
  }
  run.progress('read', boxes.length, boxes.length);
  return lines;
};
