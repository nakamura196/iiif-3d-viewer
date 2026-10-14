// 地点の付いた画像（絵図・古地図）を地図に重ねるための計算。
// 対応点（画像の x, y と地図の経度・緯度）から 1 次の多項式（アフィン変換）を最小二乗で求め、
// 画像の四隅が地図のどこに来るかを返す。地図ライブラリはこの四隅に画像を貼る。
//
// 当てはめは Web Mercator（地図の画面と同じ平面）で行う。地図はこの平面で四隅の間を
// 線形に埋めるので、ここで求めた変換と地図に描かれる画像が一致する。

export type LngLat = [number, number];

export interface ControlPoint {
  /** 画像（Canvas）上の位置。 */
  resource: [number, number];
  /** 地図上の位置（経度, 緯度）。 */
  geo: LngLat;
}

/** 画像の座標 → Web Mercator の平面（単位は地球半径 = 1）。 */
export type Affine = (x: number, y: number) => [number, number];

const toMercator = ([lng, lat]: LngLat): [number, number] => [
  (lng * Math.PI) / 180,
  Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)),
];

const fromMercator = ([mx, my]: [number, number]): LngLat => [
  (mx * 180) / Math.PI,
  (Math.atan(Math.exp(my)) * 360) / Math.PI - 90,
];

// 3 元の連立方程式を解く（クラメルの公式）。行列式がほぼ 0 なら null。
const solve3 = (m: number[][], b: number[]): number[] | null => {
  const det = (a: number[][]) =>
    a[0][0] * (a[1][1] * a[2][2] - a[1][2] * a[2][1]) -
    a[0][1] * (a[1][0] * a[2][2] - a[1][2] * a[2][0]) +
    a[0][2] * (a[1][0] * a[2][1] - a[1][1] * a[2][0]);
  const d = det(m);
  if (!Number.isFinite(d) || Math.abs(d) < 1e-12) return null;
  return [0, 1, 2].map((col) => det(m.map((row, r) => row.map((v, c) => (c === col ? b[r] : v)))) / d);
};

/**
 * 対応点から、画像の座標 → Web Mercator のアフィン変換を求める。
 * 対応点が 3 つ未満、またはすべてが一直線に並ぶときは null。
 */
export const fitAffine = (points: ControlPoint[]): Affine | null => {
  const usable = points.filter(
    (p) => p.resource.every(Number.isFinite) && p.geo.every(Number.isFinite) && Math.abs(p.geo[1]) < 85
  );
  if (usable.length < 3) return null;
  // 桁落ちを避けるため、画像の座標は平均を引き、大きさで割ってから当てはめる
  const n = usable.length;
  const cx = usable.reduce((s, p) => s + p.resource[0], 0) / n;
  const cy = usable.reduce((s, p) => s + p.resource[1], 0) / n;
  const scale = Math.max(...usable.map((p) => Math.hypot(p.resource[0] - cx, p.resource[1] - cy))) || 1;
  const rows = usable.map((p) => [(p.resource[0] - cx) / scale, (p.resource[1] - cy) / scale, 1]);
  const targets = usable.map((p) => toMercator(p.geo));
  // 正規方程式 AᵀA · a = Aᵀb
  const ata = [0, 1, 2].map((i) => [0, 1, 2].map((j) => rows.reduce((s, r) => s + r[i] * r[j], 0)));
  const coef = [0, 1].map((k) =>
    solve3(ata, [0, 1, 2].map((i) => rows.reduce((s, r, idx) => s + r[i] * targets[idx][k], 0)))
  );
  const [ax, ay] = coef;
  if (!ax || !ay) return null;
  return (x, y) => {
    const u = (x - cx) / scale;
    const v = (y - cy) / scale;
    return [ax[0] * u + ax[1] * v + ax[2], ay[0] * u + ay[1] * v + ay[2]];
  };
};

/**
 * 画像（幅 width、高さ height）の四隅の経度・緯度。
 * 順は左上・右上・右下・左下（MapLibre の image ソースの coordinates と同じ）。
 */
export const overlayCorners = (points: ControlPoint[], width: number, height: number): LngLat[] | null => {
  const affine = fitAffine(points);
  if (!affine) return null;
  return ([[0, 0], [width, 0], [width, height], [0, height]] as const).map(([x, y]) => fromMercator(affine(x, y)));
};
