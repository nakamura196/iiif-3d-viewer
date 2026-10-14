import {
  KOTEN_DET_SIZE,
  KOTEN_REC_H,
  KOTEN_REC_POSITIONS,
  KOTEN_REC_W,
  decodeParseq,
  kotenDetTensor,
  kotenLines,
  parseqTensor,
} from '../../../core';
import type { ModelRunner } from './types';
// 字の一覧（ndlkotenocr-lite の NDLmoji.yaml。CC BY 4.0、国立国会図書館）
import chars from './ndlKotenOcrLite.chars.json';

const rgbaOf = (bitmap: ImageBitmap, w: number, h: number, fill?: string): Uint8ClampedArray => {
  const cv = new OffscreenCanvas(w, h);
  const c = cv.getContext('2d', { willReadFrequently: true })!;
  if (fill) {
    c.fillStyle = fill;
    c.fillRect(0, 0, w, h);
  }
  c.drawImage(bitmap, 0, 0);
  return c.getImageData(0, 0, w, h).data;
};

const crop = (px: Uint8ClampedArray, W: number, x: number, y: number, w: number, h: number): Uint8ClampedArray => {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let r = 0; r < h; r++) out.set(px.subarray(((y + r) * W + x) * 4, ((y + r) * W + x + w) * 4), r * w * 4);
  return out;
};

export const run: ModelRunner = async ({ ort, bitmap, session, progress }) => {
  const W = bitmap.width;
  const H = bitmap.height;

  // 1. 行の検出: 紙面を正方形の左上に置き（右か下は黒）、1024 角にする
  progress('detect', 0, 1);
  const side = Math.max(W, H);
  const input = kotenDetTensor(rgbaOf(bitmap, side, side, '#000'), side);
  const det = await session('detector', 'webgpu');
  const S = KOTEN_DET_SIZE;
  const r = await det.session.run({ input: new ort.Tensor('float32', input, [1, 3, S, S]) });
  const lines = kotenLines(r.boxes.data as Float32Array, r.scores.data as Float32Array, W, H);
  progress('detect', 1, 1);

  // 2. 文字の読み取り: 1 行ずつ（NDLOCR-Lite の PARSeq では WebGPU のほうが遅かったので wasm）
  const rec = await session('recognizer', 'wasm');
  const page = rgbaOf(bitmap, W, H);
  const items = [];
  for (let i = 0; i < lines.length; i++) {
    progress('read', i, lines.length);
    const l = lines[i];
    const t = parseqTensor(crop(page, W, l.x, l.y, l.w, l.h), l.w, l.h, KOTEN_REC_W, KOTEN_REC_H);
    const out = await rec.session.run({ [rec.session.inputNames[0]]: new ort.Tensor('float32', t, [1, 3, KOTEN_REC_H, KOTEN_REC_W]) });
    const logits = out[rec.session.outputNames[0]].data as Float32Array;
    items.push({ x: l.x, y: l.y, w: l.w, h: l.h, score: l.score, text: decodeParseq(logits, KOTEN_REC_POSITIONS, chars as string[]) });
  }
  progress('read', lines.length, lines.length);
  return { kind: 'lines', items, imageWidth: W, imageHeight: H, language: 'ja' };
};
