// 塗りつぶした範囲（マスク。1 画素 1 バイト、0 以外が内側）を、外周の多角形にする。DOM に依存しない。
// いちばん大きなひとかたまりだけを取り、外周をたどって（Moore 近傍）、頂点を間引く（Douglas-Peucker）。
// 穴と、離れた小さなかけらは捨てる（顔・人物の輪郭には要らない）。

export type XY = [number, number];

/** The largest 8-connected part of a mask, as a new mask (1 inside); null when the mask is empty. */
export const largestPart = (mask: ArrayLike<number>, w: number, h: number): { mask: Uint8Array; size: number } | null => {
  const label = new Int32Array(w * h);
  const stack: number[] = [];
  let best = 0;
  let bestSize = 0;
  let next = 0;
  for (let i = 0; i < w * h; i++) {
    if (!mask[i] || label[i]) continue;
    next++;
    let size = 0;
    label[i] = next;
    stack.push(i);
    while (stack.length) {
      const p = stack.pop()!;
      size++;
      const x = p % w;
      const y = (p - x) / w;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const q = ny * w + nx;
          if (mask[q] && !label[q]) {
            label[q] = next;
            stack.push(q);
          }
        }
    }
    if (size > bestSize) {
      bestSize = size;
      best = next;
    }
  }
  if (!best) return null;
  const out = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = label[i] === best ? 1 : 0;
  return { mask: out, size: bestSize };
};

// 8 方向（右から時計回り。画像の y は下向き）
const DX = [1, 1, 0, -1, -1, -1, 0, 1];
const DY = [0, 1, 1, 1, 0, -1, -1, -1];

/** Outer boundary of a single connected part (Moore-neighbour tracing), as pixel centres. */
export const traceBoundary = (mask: ArrayLike<number>, w: number, h: number): XY[] => {
  const at = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && !!mask[y * w + x];
  let start = -1;
  for (let i = 0; i < w * h; i++)
    if (mask[i]) {
      start = i;
      break;
    }
  if (start < 0) return [];
  const sx = start % w;
  const sy = (start - sx) / w;
  const out: XY[] = [[sx, sy]];
  // 次の一歩: 来た所（back）から時計回りに見て、最初に内側の画素へ進む。
  // 最初の画素は上から走査して見つけたので、その左（方向 4）は外側
  const step = (x: number, y: number, back: number): number => {
    for (let k = 1; k <= 8; k++) {
      const d = (back + k) % 8;
      if (at(x + DX[d], y + DY[d])) return d;
    }
    return -1;
  };
  const first = step(sx, sy, 4);
  if (first < 0) return out; // 1 画素だけ
  let x = sx;
  let y = sy;
  let d = first;
  for (let guard = 0; guard < 4 * w * h; guard++) {
    x += DX[d];
    y += DY[d];
    const next = step(x, y, (d + 4) % 8);
    // 最初の画素に、最初と同じ向きで出て行くなら一周した（Jacob の止め方。細い所で早く止まらない）
    if (x === sx && y === sy && next === first) break;
    out.push([x, y]);
    d = next;
  }
  return out;
};

const distToSegment = (p: XY, a: XY, b: XY): number => {
  const vx = b[0] - a[0];
  const vy = b[1] - a[1];
  const len2 = vx * vx + vy * vy;
  const t = len2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / len2)) : 0;
  return Math.hypot(p[0] - a[0] - t * vx, p[1] - a[1] - t * vy);
};

/** Douglas-Peucker on an open polyline: keeps the points farther than `eps` from the simplified line. */
const simplifyOpen = (pts: XY[], eps: number): XY[] => {
  if (pts.length < 3) return pts.slice();
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [i, j] = stack.pop()!;
    let far = -1;
    let dmax = eps;
    for (let k = i + 1; k < j; k++) {
      const d = distToSegment(pts[k], pts[i], pts[j]);
      if (d > dmax) {
        dmax = d;
        far = k;
      }
    }
    if (far >= 0) {
      keep[far] = 1;
      stack.push([i, far], [far, j]);
    }
  }
  return pts.filter((_, k) => keep[k]);
};

/** Simplifies a closed ring (split at the point farthest from the first one). */
export const simplifyRing = (ring: XY[], eps: number): XY[] => {
  if (ring.length < 4) return ring.slice();
  let far = 0;
  let dmax = -1;
  for (let k = 1; k < ring.length; k++) {
    const d = Math.hypot(ring[k][0] - ring[0][0], ring[k][1] - ring[0][1]);
    if (d > dmax) {
      dmax = d;
      far = k;
    }
  }
  const a = simplifyOpen(ring.slice(0, far + 1), eps);
  const b = simplifyOpen([...ring.slice(far), ring[0]], eps);
  return [...a, ...b.slice(1, -1)];
};

/**
 * The outline of the largest part of a mask, as a polygon in mask pixels (pixel centres, +0.5). Null when the part
 * is too small to make a polygon.
 */
export const maskToPolygon = (mask: ArrayLike<number>, w: number, h: number, eps = 1): XY[] | null => {
  const part = largestPart(mask, w, h);
  if (!part || part.size < 3) return null;
  const ring = simplifyRing(traceBoundary(part.mask, w, h), eps);
  return ring.length >= 3 ? ring.map(([x, y]) => [x + 0.5, y + 0.5] as XY) : null;
};
