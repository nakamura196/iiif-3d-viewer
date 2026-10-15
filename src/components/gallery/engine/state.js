// state.js — モジュール間で共有する状態とユーティリティ。
// 大きな1ファイルを避けるため、可変の参照は単一オブジェクト G に集約して各モジュールで読み書きする。

import * as THREE from "three";

export const G = {
  root: null, // Kasane のページ内でギャラリーを置く要素（$ の検索範囲）
  basePath: "", // サイトのサブパス（GH Pages 用）。public/gallery/ の参照に付ける
  cfg: {}, // config.json
  QP: {}, // 画質プリセット(quality 由来)

  // three.js の中核(setupScene/Controls で生成)
  scene: null,
  camera: null,
  renderer: null,
  composer: null,
  controls: null, // OrbitControls
  walkControls: null, // PointerLockControls
  raycaster: null,
  galleryRoot: null, // 展示ごとに作り直す入れ物

  // 作品と当たり判定
  pickables: [],
  artworks: [], // 展示順の作品メッシュ(目次用。pickables と違い wall の並び順を保持)
  hovered: null, // いまレイが当たっている作品
  focused: null, // 拡大対象として選択中の作品(ホバーが外れても保持)

  // 操作モード / 歩行
  mode: "orbit", // "orbit" | "walk" | "thirdperson"
  charKind: "man", // 三人称アバター "man" | "girl"
  charLoadedKind: null,
  walkBounds: 8,
  roomShape: null, // { angles, apothem, height } 正多角形の部屋の形(カメラの壁抜け防止)
  pedestalR: 0,
  eyeY: 1.6,
  move: { f: false, b: false, l: false, r: false },
  walkVel: new THREE.Vector3(),

  // 簡易物理(ジャンプ・床/什器との当たり)
  colliders: [], // 什器の当たり箱 [{kind,x,z,r|hx,hz,rotY,top}]
  feetY: 0, // 足元の高さ
  vy: 0, // 鉛直速度
  grounded: true,

  // 自動回転の再開タイマー / クリック前進アニメ / 深ズーム領域
  idleTimer: null,
  flight: null,
  pendingRegion: null,

  osd: null, // OpenSeadragon インスタンス

  pointer: new THREE.Vector2(),
  clock: new THREE.Clock(),
};

export const IDLE_MS = 4000;

export const $ = (sel) => (G.root || document).querySelector(sel);

// 描画領域の大きさ。元は画面全体だったが、Kasane ではヘッダーの下の枠に収める
export function viewSize() {
  const el = G.root && G.root.querySelector("#scene");
  const w = (el && el.clientWidth) || window.innerWidth;
  const h = (el && el.clientHeight) || window.innerHeight;
  return { w, h };
}

// ページを開き直したときに前の展示の状態を持ち越さないよう、初期値に戻す
const INITIAL = { ...G };
export function resetState() {
  Object.assign(G, INITIAL, {
    cfg: {}, QP: {}, pickables: [], artworks: [], colliders: [],
    move: { f: false, b: false, l: false, r: false },
    walkVel: new THREE.Vector3(), pointer: new THREE.Vector2(), clock: new THREE.Clock(),
  });
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

export function easeInOutCubic(x) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

// 作品の見出し(題名 + 作者)を HTML 片に
export function labelHtml(wallCfg) {
  return (
    `<b>${escapeHtml(wallCfg.label || "")}</b>` +
    (wallCfg.by ? ` <span class="by">${escapeHtml(wallCfg.by)}</span>` : "")
  );
}
