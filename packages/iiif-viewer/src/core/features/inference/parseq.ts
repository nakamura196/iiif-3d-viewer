// PARSeq（NDLOCR-Lite と NDL古典籍OCR-Lite の文字の読み取り）の前処理と、出力から字を取り出す処理。
// どちらも原本の parseq.py と同じ: 縦長の行は左に 90 度回す → 幅×高さに縮める（BICUBIC）→ BGR → -1〜1。
// 読みは、位置ごとに一番の字を取り、止まりの記号（0）までをつなぐ。字の一覧は 1 から始まる（0 が止まり）。
import { bgrTensor, resizeRgba, rotateLeft } from './pixels';

/** Input tensor for one line, from the RGBA pixels of the line crop. */
export const parseqTensor = (px: Uint8ClampedArray, w: number, h: number, W: number, H: number): Float32Array => {
  let p = px;
  let cw = w;
  let ch = h;
  if (ch > cw) {
    p = rotateLeft(p, cw, ch);
    [cw, ch] = [ch, cw];
  }
  p = resizeRgba(p, cw, ch, W, H);
  // 2 * (v / 255 - 0.5) = (v - 127.5) / 127.5
  return bgrTensor(p, W, H, [127.5, 127.5, 127.5], [127.5, 127.5, 127.5]);
};

/** Greedy reading of the output [positions, classes]. `chars[k - 1]` is class k; class 0 ends the text. */
export const decodeParseq = (logits: ArrayLike<number>, positions: number, chars: string[]): string => {
  const C = logits.length / positions;
  let text = '';
  for (let p = 0; p < positions; p++) {
    let best = 0;
    let bv = -Infinity;
    for (let k = 0; k < C; k++)
      if (logits[p * C + k] > bv) {
        bv = logits[p * C + k];
        best = k;
      }
    if (best === 0) break;
    text += chars[best - 1] ?? '';
  }
  return text;
};
