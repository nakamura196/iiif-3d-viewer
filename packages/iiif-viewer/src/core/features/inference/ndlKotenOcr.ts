// NDL古典籍OCR-Lite（行の検出 RTMDet-s ＋ 文字の読み取り PARSeq）の、モデルの外の手順。原本 ndlkotenocr-lite の
// rtmdet.py・ndl_parser.py・reading_order/order/reorder.py と同じにした（docviz の src/koten/main.ts から写した。
// docviz では原本の ocr.py の出力と、東海道の見本 27 行すべてで枠・読む順・文字が一致した）。
import { nms } from './nms';
import { bgrTensor, resizeRgba } from './pixels';
import { readingOrder } from './readingOrder';

/** Side of the square the line detector takes. */
export const KOTEN_DET_SIZE = 1024;
/** Text line crop size for the PARSeq of NDL古典籍OCR-Lite, and the number of output positions (100 characters + end). */
export const KOTEN_REC_W = 384;
export const KOTEN_REC_H = 32;
export const KOTEN_REC_POSITIONS = 101;

/** The defaults of ndlkotenocr-lite's ocr.py and of the NMS inside the original graph. */
export const KOTEN_NMS = { score: 0.3, iou: 0.65, scoreMin: 0.001, topK: 3000, maxKeep: 200 };

/**
 * Detector input from the RGBA pixels of a square `side` x `side` (the page put at the top left, black to the right
 * or below): resized to 1024, BGR, mean/std of rtmdet.py.
 */
export const kotenDetTensor = (square: Uint8ClampedArray, side: number): Float32Array => {
  const S = KOTEN_DET_SIZE;
  const px = side === S ? square : resizeRgba(square, side, side, S, S);
  return bgrTensor(px, S, S, [103.53, 116.28, 123.675], [57.375, 57.12, 58.395]);
};

export interface KotenLine {
  /** Image pixels (integers). */
  x: number;
  y: number;
  w: number;
  h: number;
  score: number;
  box: [number, number, number, number];
}

/**
 * The lines to read, in reading order, from the detector output (boxes: x1,y1,x2,y2 in 1024 px; scores: one per
 * candidate). W, H: the image size. As in rtmdet.py / ndl_parser.py: back to image pixels, 2% of the height added above
 * and below, corners truncated, lines under 5 px dropped; then the block XY-cut order and remove_dup.
 */
export const kotenLines = (boxes: ArrayLike<number>, scores: ArrayLike<number>, W: number, H: number): KotenLine[] => {
  const keep = nms(boxes, scores, {
    iou: KOTEN_NMS.iou,
    // the threshold first: a box above it can only be removed by a more confident one, also above it
    scoreMin: KOTEN_NMS.score,
    topK: KOTEN_NMS.topK,
    maxKeep: KOTEN_NMS.maxKeep,
  });
  const m = Math.max(W, H) / KOTEN_DET_SIZE;
  const lines: KotenLine[] = [];
  for (const i of keep) {
    const x1 = boxes[i * 4] * m;
    const x2 = boxes[i * 4 + 2] * m;
    const dh = (boxes[i * 4 + 3] - boxes[i * 4 + 1]) * m * 0.02;
    const y1 = boxes[i * 4 + 1] * m - dh;
    const y2 = boxes[i * 4 + 3] * m + dh;
    const x = Math.max(0, Math.trunc(x1));
    const y = Math.max(0, Math.trunc(y1));
    const w = Math.min(Math.trunc(W), Math.trunc(x2)) - x;
    const h = Math.min(Math.trunc(H), Math.trunc(y2)) - y;
    if (w < 5 || h < 5) continue;
    lines.push({ x, y, w, h, score: scores[i], box: [x, y, w, h] });
  }
  return removeDup(readingOrder(lines).ordered);
};

/**
 * remove_dup of reorder.py: when a line overlaps the one before it by more than 90% of the smaller area, keep the more
 * confident one (compared at 3 decimals, as written to the XML; the earlier one on a tie).
 */
const removeDup = (ls: KotenLine[]): KotenLine[] => {
  const conf = (l: KotenLine) => Math.round(l.score * 1000);
  const out: KotenLine[] = [];
  for (const l of ls) {
    const p = out[out.length - 1];
    if (p) {
      const iw = Math.max(0, Math.min(p.x + p.w, l.x + l.w) - Math.max(p.x, l.x));
      const ih = Math.max(0, Math.min(p.y + p.h, l.y + l.h) - Math.max(p.y, l.y));
      if ((iw * ih) / Math.min(p.w * p.h, l.w * l.h) > 0.9) {
        if (conf(p) >= conf(l)) continue;
        out.pop();
      }
    }
    out.push(l);
  }
  return out;
};
