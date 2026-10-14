// 重なった候補の枠を間引く（NMS）。貪欲法: 確からしい順に 1 つ残し、それとの重なり（IoU）が iou を超える枠を消す。

export interface NmsOptions {
  /** Drop boxes whose IoU with a kept box is above this. */
  iou: number;
  /** Ignore candidates at or below this score. */
  scoreMin: number;
  /** Look only at the `topK` most confident candidates (after `scoreMin`). */
  topK?: number;
  /** Keep at most this many boxes. */
  maxKeep?: number;
}

/** IoU of boxes a and b in `boxes` (x1,y1,x2,y2 per box). */
export const iouOf = (boxes: ArrayLike<number>, a: number, b: number): number => {
  const iw = Math.min(boxes[a * 4 + 2], boxes[b * 4 + 2]) - Math.max(boxes[a * 4], boxes[b * 4]);
  const ih = Math.min(boxes[a * 4 + 3], boxes[b * 4 + 3]) - Math.max(boxes[a * 4 + 1], boxes[b * 4 + 1]);
  if (iw <= 0 || ih <= 0) return 0;
  const inter = iw * ih;
  const area = (k: number) => (boxes[k * 4 + 2] - boxes[k * 4]) * (boxes[k * 4 + 3] - boxes[k * 4 + 1]);
  return inter / (area(a) + area(b) - inter);
};

/** Indices of the kept boxes, most confident first. */
export const nms = (boxes: ArrayLike<number>, scores: ArrayLike<number>, o: NmsOptions): number[] => {
  const all: number[] = [];
  for (let i = 0; i < scores.length; i++) if (scores[i] > o.scoreMin) all.push(i);
  all.sort((a, b) => scores[b] - scores[a]);
  const cand = o.topK ? all.slice(0, o.topK) : all;
  const gone = new Uint8Array(scores.length);
  const keep: number[] = [];
  for (const i of cand) {
    if (gone[i]) continue;
    if (o.maxKeep !== undefined && keep.length >= o.maxKeep) break;
    keep.push(i);
    for (const j of cand) if (!gone[j] && j !== i && iouOf(boxes, i, j) > o.iou) gone[j] = 1;
  }
  return keep;
};
