// ジオリファレンスの画面（/georef）の表示状態を、URL の引数と行き来させる。
// 引数の名前と意味は geo.ldas.jp（nakamura196/iiif_geo）に合わせ、向こうのリンクをそのまま開けるようにする。
//
//   u                      マニフェストの URL（iiif-content・manifest が無いときに読む）
//   mapZoom・mapLat・mapLng 地図の縮尺と中心
//   lat・lng               地図に印を立てる地点（読むだけ。mapLat・mapLng が無ければ中心もここで、縮尺の既定は 15）
//   zoom・centerX・centerY  画像の拡大率と中心。OpenSeadragon の座標で、画像の幅を 1 とする
//   rotation               画像の回転（度、反時計回りが正）。OpenSeadragon には符号を反転して渡していた。
//                          無ければ、地点が 2 つ以上あるとき北が上になるよう自動で回す
//   id                     選んでいる地点

/** 地図の縮尺と中心。 */
export interface GeorefMapView {
  zoom: number;
  lat: number;
  lng: number;
}

/**
 * 画像の拡大率と中心（OpenSeadragon の viewport 座標）。
 * zoom は 1 のとき画像の幅が表示枠の幅にちょうど収まる。centerX・centerY は画像の幅を 1 とした位置。
 */
export interface GeorefImageView {
  zoom: number;
  centerX: number;
  centerY: number;
}

export interface GeorefUrlState {
  manifest: string | null;
  map?: GeorefMapView;
  focus?: { lat: number; lng: number };
  image?: GeorefImageView;
  /** 画像の回転（度、反時計回りが正。geo.ldas.jp の rotation と同じ向き）。 */
  rotation?: number;
  id?: string;
}

/** 中心だけが指定されたときの地図の縮尺（lat・lng のときの geo.ldas.jp の既定と同じ）。 */
export const FOCUS_MAP_ZOOM = 15;

// 画像の置き場所が nakamura196.github.io/iiif_geo/ から geo.ldas.jp/ に移った（2026-09）。
// 古い場所は 301 で転送するが、転送に Access-Control-Allow-Origin が付かず、ブラウザが読めない。
// 古いリンクの u は、新しい場所に読み替える（geo.ldas.jp の utils/manifestUrl.ts と同じ）
const OLD_BASES = ['https://nakamura196.github.io/iiif_geo/', 'http://nakamura196.github.io/iiif_geo/'];
const NEW_BASE = 'https://geo.ldas.jp/';

export function rewriteOldGeoHost(url: string): string {
  for (const old of OLD_BASES) {
    if (url.startsWith(old)) return NEW_BASE + url.slice(old.length);
  }
  return url;
}

const num = (params: URLSearchParams, key: string): number | undefined => {
  const raw = params.get(key);
  if (raw === null || raw.trim() === '') return undefined;
  const v = Number(raw);
  return Number.isFinite(v) ? v : undefined;
};

/** URL の引数から表示状態を読む。数として読めない値は無いものとして扱う。 */
export function readGeorefParams(params: URLSearchParams, manifestFromOther: string | null): GeorefUrlState {
  const u = params.get('u');
  const state: GeorefUrlState = {
    manifest: manifestFromOther ?? (u ? rewriteOldGeoHost(u) : null),
  };

  const mapZoom = num(params, 'mapZoom');
  const mapLat = num(params, 'mapLat');
  const mapLng = num(params, 'mapLng');
  const lat = num(params, 'lat');
  const lng = num(params, 'lng');
  if (lat !== undefined && lng !== undefined) state.focus = { lat, lng };
  // 中心は mapLat・mapLng を先に見る。lat・lng は地図を動かしても URL に残るので、
  // geo.ldas.jp のように lat・lng を先にすると、動かした後の URL で開き直しても印の位置に戻ってしまう
  if (mapLat !== undefined && mapLng !== undefined) {
    state.map = { zoom: mapZoom ?? FOCUS_MAP_ZOOM, lat: mapLat, lng: mapLng };
  } else if (state.focus) {
    state.map = { zoom: mapZoom ?? FOCUS_MAP_ZOOM, ...state.focus };
  }
  // 中心の無い mapZoom だけでは地図を動かさない（すべての地点が収まる縮尺で開く）。
  // geo.ldas.jp は mapZoom が無いとき zoom（画像の拡大率）を地図にも使っていたが、取り違えなので移さない

  const zoom = num(params, 'zoom');
  const centerX = num(params, 'centerX');
  const centerY = num(params, 'centerY');
  if (zoom !== undefined && zoom > 0 && centerX !== undefined && centerY !== undefined) {
    state.image = { zoom, centerX, centerY };
  }

  const rotation = num(params, 'rotation');
  if (rotation !== undefined) state.rotation = normalizeAngle(rotation);

  const id = params.get('id');
  if (id) state.id = id;
  return state;
}

/** 書き戻す引数。null の項目は URL から消す。 */
export type GeorefParamPatch = Partial<Record<'mapZoom' | 'mapLat' | 'mapLng' | 'zoom' | 'centerX' | 'centerY' | 'rotation' | 'id', string | null>>;

export const mapViewParams = (v: GeorefMapView): GeorefParamPatch => ({
  mapZoom: String(Number(v.zoom.toFixed(2))),
  mapLat: v.lat.toFixed(6),
  mapLng: v.lng.toFixed(6),
});

export const imageViewParams = (v: GeorefImageView): GeorefParamPatch => ({
  zoom: v.zoom.toFixed(2),
  centerX: v.centerX.toFixed(4),
  centerY: v.centerY.toFixed(4),
});

/** 回転は 0.1 度まで書く（スライダーは 1 度刻み、自動回転は端数が出る）。 */
export const rotationParams = (rotation: number): GeorefParamPatch => ({
  rotation: String(Number(normalizeAngle(rotation).toFixed(1))),
});

/** 角度を -180 より大きく 180 以下にそろえる。 */
export function normalizeAngle(degrees: number): number {
  const a = ((degrees % 360) + 360) % 360;
  return a > 180 ? a - 360 : a;
}

// ── 北が上になる回転 ──
// 画像の地点（x, y。y は下向き）と地図の地点（経度・緯度）の組から、画像をどれだけ回せば
// 北が上・東が右になるかを、回転だけの当てはめ（最小二乗）で求める。
// geo.ldas.jp の utils/rotation.ts（Procrustes 解析）と同じ計算。経度は緯度の cos で縮める。
// geo.ldas.jp は地点がちょうど 2 つのとき別の式（2 点を結ぶ向き）を使っていたが、
// その式は 90 度ずれる（画像の右が北のとき 0 度を返す）ので移さない。2 つでもこの計算で正しく求まる。

export interface GeorefPair {
  x: number;
  y: number;
  lng: number;
  lat: number;
}

/** 北が上になる回転（度、反時計回りが正）。地点が 2 つ未満か、地点が 1 か所に重なっているときは null。 */
export function northUpRotation(pairs: GeorefPair[]): number | null {
  const ok = pairs.filter((p) => [p.x, p.y, p.lng, p.lat].every(Number.isFinite));
  if (ok.length < 2) return null;
  const n = ok.length;
  const cosLat = Math.cos((ok.reduce((s, p) => s + p.lat, 0) / n) * (Math.PI / 180));
  const ix = ok.reduce((s, p) => s + p.x, 0) / n;
  const iy = ok.reduce((s, p) => s + p.y, 0) / n;
  const gx = ok.reduce((s, p) => s + p.lng * cosLat, 0) / n;
  const gy = ok.reduce((s, p) => s + p.lat, 0) / n;
  let cross = 0;
  let dot = 0;
  for (const p of ok) {
    // 画像は y を上向きに直してから比べる
    const sx = p.x - ix;
    const sy = -(p.y - iy);
    const tx = p.lng * cosLat - gx;
    const ty = p.lat - gy;
    cross += sx * ty - sy * tx;
    dot += sx * tx + sy * ty;
  }
  if (cross === 0 && dot === 0) return null;
  return normalizeAngle((Math.atan2(cross, dot) * 180) / Math.PI);
}

/** 引数を書き換えた後の検索文字列（先頭の ? は付けない）。ほかの引数は触らない。 */
export function applyGeorefPatch(search: string, patch: GeorefParamPatch): string {
  const params = new URLSearchParams(search);
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === undefined) params.delete(key);
    else params.set(key, value);
  }
  return params.toString();
}

// ── 画像の表示と OpenSeadragon の座標の換算 ──
// Kasane の画像の表示（ImageView）は、Canvas を表示枠に収めた「台」（stageW × stageH）を、
// 枠の中心を原点に scale 倍して (tx, ty) ずらす。OpenSeadragon は画像の幅を 1 とする座標で、
// zoom 1 は画像の幅が枠の幅に収まる状態。

export interface StageGeometry {
  stageW: number;
  stageH: number;
  boxW: number;
}

export interface StageView {
  scale: number;
  tx: number;
  ty: number;
  /** 台の回転（度、時計回りが正。CSS の rotate と同じ）。 */
  rotation?: number;
}

// 台の上の点（台の中心から d）は、枠の中心から t + scale × R(rotation) d に出る
const rotateBy = (x: number, y: number, degrees: number): [number, number] => {
  const r = (degrees * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [x * c - y * s, x * s + y * c];
};

/** 今の表示を OpenSeadragon の拡大率・中心にする。 */
export function stageToImageView(view: StageView, stage: StageGeometry, canvasWidth: number, canvasHeight: number): GeorefImageView {
  // 枠の中心に出ている台の上の点
  const [dx, dy] = rotateBy(-view.tx / view.scale, -view.ty / view.scale, -(view.rotation ?? 0));
  const x = 0.5 + dx / stage.stageW; // 画像の幅に対する割合
  const y = 0.5 + dy / stage.stageH; // 画像の高さに対する割合
  return {
    zoom: (view.scale * stage.stageW) / stage.boxW,
    centerX: x,
    centerY: (y * canvasHeight) / canvasWidth,
  };
}

/** OpenSeadragon の拡大率・中心から、表示の scale・tx・ty を求める。rotation は台の回転（時計回り）。 */
export function imageViewToStage(
  v: GeorefImageView,
  stage: StageGeometry,
  canvasWidth: number,
  canvasHeight: number,
  rotation = 0,
): StageView {
  const scale = (v.zoom * stage.boxW) / stage.stageW;
  const x = v.centerX;
  const y = (v.centerY * canvasWidth) / canvasHeight;
  const [dx, dy] = rotateBy((x - 0.5) * stage.stageW, (y - 0.5) * stage.stageH, rotation);
  return { scale, tx: -scale * dx, ty: -scale * dy, rotation };
}
