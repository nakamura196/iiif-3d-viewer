// 画像の上の点を、画面の上で近いものどうし 1 つにまとめる（ジオリファレンスの画面 /georef の画像）。
// 地図のまとめ（maplibre の GeoJSON の cluster、中身は supercluster）と同じ考え方で、
// 拡大の段ごとに、まだまとまっていない点を順に取り、半径の中にある残りの点を吸い込む。
// 近くの点は格子で引くので、点の数にほぼ比例する時間で済む。
// 画面上の距離は画像を回しても変わらないので、まとめは拡大率だけで決まり、移動・回転では数え直さない。

export interface ClusterPoint {
  id: string;
  /** Canvas 座標。 */
  x: number;
  y: number;
}

export interface PointCluster {
  /** まとめた点の id（入力の順）。 */
  ids: string[];
  /** 点の重心（Canvas 座標）。 */
  x: number;
  y: number;
  /** 点の広がり（Canvas 座標）。 */
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * 点をまとめる。pxPerUnit は Canvas の 1 単位が画面で何 px になるか、radius はまとめる距離（画面の px）。
 * 1 点だけのまとまりも返す。
 */
export function clusterPoints(points: ClusterPoint[], pxPerUnit: number, radius: number): PointCluster[] {
  const ok = points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  if (!(pxPerUnit > 0) || !(radius > 0)) return ok.map(single);
  // 半径を Canvas 座標に直し、その大きさの格子に点を入れる
  const r = radius / pxPerUnit;
  const cellOf = (v: number) => Math.floor(v / r);
  const grid = new Map<string, number[]>();
  ok.forEach((p, i) => {
    const key = `${cellOf(p.x)},${cellOf(p.y)}`;
    const cell = grid.get(key);
    if (cell) cell.push(i);
    else grid.set(key, [i]);
  });
  const taken = new Uint8Array(ok.length);
  const clusters: PointCluster[] = [];
  const r2 = r * r;
  ok.forEach((p, i) => {
    if (taken[i]) return;
    taken[i] = 1;
    const members = [i];
    const cx = cellOf(p.x);
    const cy = cellOf(p.y);
    for (let gx = cx - 1; gx <= cx + 1; gx++) {
      for (let gy = cy - 1; gy <= cy + 1; gy++) {
        for (const j of grid.get(`${gx},${gy}`) ?? []) {
          if (taken[j]) continue;
          const q = ok[j];
          if ((q.x - p.x) ** 2 + (q.y - p.y) ** 2 <= r2) {
            taken[j] = 1;
            members.push(j);
          }
        }
      }
    }
    members.sort((a, b) => a - b);
    const c = single(ok[members[0]]);
    let sx = 0;
    let sy = 0;
    for (const k of members) {
      const m = ok[k];
      sx += m.x;
      sy += m.y;
      c.minX = Math.min(c.minX, m.x);
      c.minY = Math.min(c.minY, m.y);
      c.maxX = Math.max(c.maxX, m.x);
      c.maxY = Math.max(c.maxY, m.y);
    }
    c.ids = members.map((k) => ok[k].id);
    c.x = sx / members.length;
    c.y = sy / members.length;
    clusters.push(c);
  });
  return clusters;
}

const single = (p: ClusterPoint): PointCluster => ({ ids: [p.id], x: p.x, y: p.y, minX: p.x, minY: p.y, maxX: p.x, maxY: p.y });

/** 1 段で拡大率が何倍になるか（2 段で 2 倍）。 */
const LEVEL_STEP = Math.SQRT2;

/**
 * まとめに使う拡大率。拡大率を段に丸める。ホイールで少し動かすたびに数え直さず、
 * 段が変わったときだけまとめ直すため（地図の整数の縮尺ごとのまとめと同じ）。
 */
export function clusterLevelScale(scale: number): number {
  if (!(scale > 0)) return 1;
  return LEVEL_STEP ** Math.round(Math.log(scale) / Math.log(LEVEL_STEP));
}

/**
 * まとまりを押したときに寄る拡大率。点の広がりが表示枠の短い辺の半分に収まる拡大率にする。
 * 一番寄っても点が半径の中に収まったまま（同じ場所の点）なら null を返す（一覧を出して選ばせる）。
 * unitPx は拡大率 1 のとき Canvas の 1 単位が何 px か。
 */
export function clusterExpansionScale(
  cluster: PointCluster,
  unitPx: number,
  box: { w: number; h: number },
  current: number,
  max: number,
  radius: number,
): number | null {
  const extent = Math.hypot(cluster.maxX - cluster.minX, cluster.maxY - cluster.minY);
  if (!(extent * unitPx * max > radius)) return null;
  const fit = (Math.min(box.w, box.h) * 0.5) / (extent * unitPx);
  // 少なくとも 2 倍は寄る（押しても変わらないように見えないため）
  return Math.min(max, Math.max(fit, current * 2));
}
