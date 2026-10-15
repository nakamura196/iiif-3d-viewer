// tour.js — 自動鑑賞ツアー + 録画。
// 一人称相当のカメラを、各作品の「正面で見る視点」へ決定的に巡回させ、その映像を録画する。
// VR セッション中はページの canvas が更新されない(録画できない)ため、VR ではなく
// 通常の描画経路(G.composer.render)を使う。canvas.captureStream はキャンバスのピクセルだけを
// 録るので、HUD・十字・ボタン等の DOM オーバーレイは映らない(クリーンな鑑賞動画になる)。

import * as THREE from "three";
import { G, $, easeInOutCubic, viewSize } from "./state.js";
import { t } from "./i18n.js";
import { loadAvatar } from "./avatar.js";
import { resolveMove } from "./controls.js";

// ツアー状態(モジュールローカル。loop からは updateTour 経由で進める)
let tour = null;          // { stops, i, phase, t, ... } 進行中のツアー、無ければ null
let recorder = null;      // MediaRecorder
let chunks = [];          // 録画データ片
let prevControlsEnabled = null; // ツアー前の controls.enabled を退避

// 1作品あたりの時間配分(秒)
const TRAVEL = 2.4;       // 移動時間の既定(距離不明時のフォールバック)
const TRAVEL_SPEED = 2.4; // 移動の目安速度(m/s)。距離からの移動時間 = dist/speed を 1.3〜3.6s でクランプ
const DWELL = 3.4;        // 作品の前で鑑賞する(寄り)時間。ズームを見せるため少し長め
const NEAR_FRAC = 0.42;   // 寄り終点の距離 = 立ち位置距離 × これ(小さいほど近づく=ズームイン)
const HIRES_PX = 4096;    // 寄ったとき差し替える高精細タイルの長辺px(元画像幅を上限にクランプ)
const TURN_AT = 0.6;      // 移動の何割を過ぎたら絵へ向き直り始めるか(残りで turn)

// 三人称ツアー(アバターが歩く)の追従カメラ
const FOLLOW_DIST = 4.0;  // アバター背後へ回り込むカメラ距離
const FOLLOW_H = 1.95;    // 追従カメラの高さ
const TURN_SPEED = 4.0;   // 鑑賞時にアバターが作品へ向き直る角速度(rad/s 相当)

// 導入(展示空間を見渡す)フェーズと、デモ用の巡回点数
const INTRO = 6.5;        // 冒頭に空間を見渡す秒数(0 や cfg.tourIntro:false で無効)
const DEFAULT_MAX = 5;    // デモは全作品を回らず、この点数に間引く(cfg.tourMax で変更)

// 作品を正面に収める視点を作る。center/normal は room.js が userData に入れている。
// normal は「作品から部屋中心へ」向く単位ベクトル(鑑賞者が立つ側)。
function viewFor(art) {
  const { center, normal, artH } = art.userData;
  const fov = THREE.MathUtils.degToRad(G.camera.fov);
  const eyeY = G.eyeY ?? 1.6;
  // 作品の高さが画面に収まる距離(startFlight と同じ考え方。少し余白を持たせる)
  const dist = Math.max(1.2, (artH / 2) / Math.tan(fov / 2) * 1.35);
  const pos = center.clone().addScaledVector(normal, dist);
  pos.y = eyeY; // 人の目線の高さで一定に(歩いている感)
  return { pos, look: center.clone(), dist, eyeY };
}

// pos に居て look を見るカメラ姿勢(quaternion)。位置と向きを別々に補間するため分離。
const _m = new THREE.Matrix4();
const _up = new THREE.Vector3(0, 1, 0);
function quatLookingAt(pos, look) {
  _m.lookAt(pos, look, _up);
  return new THREE.Quaternion().setFromRotationMatrix(_m);
}

// 配列から均等間隔で n 件を抜き出す(部屋を一周しつつ間引く)。
function sampleEven(arr, n) {
  if (n <= 0 || arr.length <= n) return arr;
  const out = [];
  for (let i = 0; i < n; i++) out.push(arr[Math.floor((i * arr.length) / n)]);
  return out;
}

// ツアー経路を作る。pickables(壁の作品)を配置順に巡る。max>0 ならデモ用に間引く。
function buildStops(max) {
  const all = G.pickables.filter((a) => a.userData?.resolved);
  const arts = max > 0 ? sampleEven(all, max) : all;
  return arts.map((art) => {
    const v = viewFor(art);
    // 寄り終点: 作品に向かって近づいた位置(normal は中心向きなので、距離を縮めると作品へ寄る)
    const posNear = v.look.clone().addScaledVector(art.userData.normal, Math.max(0.55, v.dist * NEAR_FRAC));
    posNear.y = v.eyeY;
    return {
      art,
      pos: v.pos,
      look: v.look,
      posNear,
      quat: quatLookingAt(v.pos, v.look),
    };
  });
}

// 作品テクスチャを高精細な IIIF タイルへ差し替える(寄ったとき細部が鮮明になる)。
// xr.js の updateHiRes と同じ流儀。一度上げた解像度は ud._hiResPx に記録し再ロードしない。
function upgradeArtwork(art, px = HIRES_PX) {
  const ud = art.userData;
  if (!ud?.resolved) return;
  const want = Math.min(px, ud.resolved.width || px);
  if ((ud._hiResPx || 0) >= want) return;
  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin("anonymous");
  loader.load(ud.resolved.thumb(want), (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = G.renderer.capabilities.getMaxAnisotropy();
    const old = art.material.map;
    art.material.map = tex;
    art.material.color.setHex(0xffffff);
    art.material.needsUpdate = true;
    old?.dispose?.();
    ud._hiResPx = want;
  });
}

// ── 作品キャプション(画面内に題名・作者を焼き込む) ───────────────────
// HUD(DOM)は canvas.captureStream に映らないため、カメラに追従する 3D 板で表示する。
// 鑑賞(dwell)中だけ画面下に出し、フェードイン/アウトする。
let captionMesh = null, captionTex = null;
function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function ensureCaption() {
  if (captionMesh) return;
  const canvas = document.createElement("canvas");
  canvas.width = 1024; canvas.height = 220;
  captionTex = new THREE.CanvasTexture(canvas);
  captionTex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: captionTex, transparent: true, depthTest: false, depthWrite: false, opacity: 0 });
  captionMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.142), mat);
  captionMesh.renderOrder = 1000;
  captionMesh.frustumCulled = false;
  captionMesh.position.set(0, -0.30, -0.9); // 視界の下寄り(lower-third)、90cm 前
  captionMesh.visible = false;
  captionMesh.userData.canvas = canvas;
}
function drawCaption(wallCfg) {
  ensureCaption();
  const canvas = captionMesh.userData.canvas;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const title = (wallCfg?.label || "").trim();
  const by = (wallCfg?.by || "").trim();
  if (!title && !by) return;
  ctx.fillStyle = "rgba(10,11,14,0.62)";
  roundRectPath(ctx, 36, 44, 952, 132, 20); ctx.fill();
  ctx.fillStyle = "rgba(201,164,76,0.9)"; // 上品な金の縁取りライン
  ctx.fillRect(36, 44, 6, 132);
  ctx.textAlign = "left"; ctx.textBaseline = "middle";
  ctx.fillStyle = "#f2ece0";
  ctx.font = "600 48px -apple-system, 'Hiragino Sans', sans-serif";
  ctx.fillText(title, 72, by ? 92 : 110, 884);
  if (by) {
    ctx.fillStyle = "#c7bfa8";
    ctx.font = "30px -apple-system, 'Hiragino Sans', sans-serif";
    ctx.fillText(by, 72, 138, 884);
  }
  captionTex.needsUpdate = true;
}
// dwell の進行 t(0..1)から不透明度(序盤フェードイン・終盤フェードアウト)
function captionOpacity(t) {
  const inT = 0.12, outT = 0.86;
  if (t < inT) return t / inT;
  if (t > outT) return Math.max(0, (1 - t) / (1 - outT));
  return 1;
}
// カメラはシーングラフに入っていない(composer は G.scene のみ走査する)ため、
// カメラの子にすると描画されない。毎フレーム「カメラの少し前・下(lower-third)」のワールド
// 位置へ置き、カメラの向きに合わせる(=常に画面下に正対して映る)。
const _capOff = new THREE.Vector3();
function showCaption(opacity) {
  if (!captionMesh) return;
  if (captionMesh.parent !== G.scene) G.scene.add(captionMesh);
  captionMesh.quaternion.copy(G.camera.quaternion);
  _capOff.set(0, -0.30, -0.9).applyQuaternion(G.camera.quaternion);
  captionMesh.position.copy(G.camera.position).add(_capOff);
  captionMesh.material.opacity = opacity;
  captionMesh.visible = opacity > 0.01;
}
function hideCaption() {
  if (captionMesh) {
    captionMesh.visible = false;
    if (captionMesh.parent) captionMesh.parent.remove(captionMesh);
  }
}

// MediaRecorder の対応コーデックを選ぶ(VP9 > VP8 > 既定)。
// コーデック選定: H.264(mp4) を最優先(どの環境でも軽く再生でき QuickTime/Safari でも開ける。
// 多くは HW デコード) → 無ければ VP9/VP8(webm)。
function pickMime() {
  const cands = [
    "video/mp4;codecs=h264",
    "video/mp4;codecs=avc1.42E01E",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
    "video/mp4",
  ];
  return cands.find((m) => window.MediaRecorder?.isTypeSupported?.(m)) || "";
}

// 録画時だけ描画解像度を上限(既定1440p)へ抑える。アスペクト比は保つ(歪まない)。
// 3600px(retina)の素のままだと巨大かつ VP9 ソフトデコードで再生が重い。元の dpr は復元する。
let _savedDpr = null;
function applyCaptureResolution() {
  const targetH = G.cfg.tourHeight ?? 1440;
  const ih = viewSize().h || 1080;
  const cur = G.renderer.getPixelRatio();
  const dpr = Math.min(cur, targetH / ih);
  if (dpr < cur - 1e-3) {
    _savedDpr = cur;
    G.renderer.setPixelRatio(dpr);
    // EffectComposer は構築時の pixelRatio を内部に保持するため setSize では反映されない。
    // setPixelRatio でポストプロセスのレンダーターゲットも下げる(描画コストも下がる)。
    G.composer.setPixelRatio(dpr);
  }
}
function restoreCaptureResolution() {
  if (_savedDpr == null) return;
  G.renderer.setPixelRatio(_savedDpr);
  G.composer.setPixelRatio(_savedDpr);
  _savedDpr = null;
}

// 解像度・fps に見合うビットレート(約0.11 bpp)。cfg.tourBitrate で上書き可。
function captureBitrate() {
  if (G.cfg.tourBitrate) return G.cfg.tourBitrate;
  const dpr = G.renderer.getPixelRatio();
  const w = Math.round(viewSize().w * dpr), h = Math.round(viewSize().h * dpr);
  const fps = G.cfg.tourFps ?? 30;
  return Math.min(20_000_000, Math.max(6_000_000, Math.round(w * h * fps * 0.11)));
}

function startRecording() {
  chunks = [];
  applyCaptureResolution(); // captureStream の前に解像度を確定させる
  const fps = G.cfg.tourFps ?? 30;
  const stream = G.renderer.domElement.captureStream(fps);
  const mimeType = pickMime();
  const opts = { videoBitsPerSecond: captureBitrate() };
  if (mimeType) opts.mimeType = mimeType;
  try {
    recorder = new MediaRecorder(stream, opts);
  } catch (err) {
    console.warn("MediaRecorder 初期化に失敗。録画なしでツアーを続けます。", err);
    recorder = null;
    restoreCaptureResolution();
    return;
  }
  recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  recorder.onstop = saveRecording;
  recorder.start(1000); // 1秒ごとに flush(長尺でもメモリが膨らみにくい)
}

function saveRecording() {
  if (!chunks.length) return;
  const type = chunks[0].type || "video/webm";
  const blob = new Blob(chunks, { type });
  chunks = [];
  const ext = type.includes("mp4") ? "mp4" : "webm";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  a.href = url;
  a.download = `gallery-tour-${stamp}.${ext}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

let starting = false; // 開始処理中(三人称はアバター読込を待つ間の二重起動を防ぐ)

// ツアー開始。mode 未指定なら現在のモードに追従(三人称ならアバターが歩く版、それ以外は一人称版)。
// opts.max: 巡回する作品数(既定 cfg.tourMax→DEFAULT_MAX、0 で全作品)。opts.intro: 導入フェーズ。
export async function startTour({ record = true, mode, max, intro } = {}) {
  if (tour || starting) return;
  const maxN = max ?? G.cfg.tourMax ?? DEFAULT_MAX;
  const stops = buildStops(maxN);
  if (!stops.length) return;
  const tmode = mode || (G.mode === "thirdperson" ? "third" : "first");
  const introOn = (intro ?? G.cfg.tourIntro ?? true) !== false && INTRO > 0;
  starting = true;

  // 通常操作・自動回転を止め、カメラを直接駆動する。HUD/十字は録画に映らないが念のため隠す。
  prevControlsEnabled = G.controls ? G.controls.enabled : null;
  if (G.controls) { G.controls.autoRotate = false; G.controls.enabled = false; }
  if (G.walkControls?.isLocked) G.walkControls.unlock();
  if (G.idleTimer) clearTimeout(G.idleTimer);
  $("#hud")?.classList.remove("show");
  $("#crosshair")?.classList.remove("show");

  // 三人称版はアバターの読込完了を待つ(録画開始前に確実にモデルを出す)
  const useThird = tmode === "third" && (await ensureAvatar());

  tour = {
    stops,
    i: 0,
    phase: introOn ? "intro" : "travel", // "intro"(空間を見渡す) | "travel"(移動) | "dwell"(鑑賞)
    t: 0,
    mode: useThird ? "third" : "first",
    restoreMode: G.mode,
    fromPos: G.camera.position.clone(),
    fromQuat: G.camera.quaternion.clone(),
    recording: record,
  };
  setupIntroParams(introOn);
  if (useThird) setupThirdStart();
  else applyFirstPersonStartPose(); // 録画1フレーム目が前のカメラのままにならないよう開始姿勢へ
  starting = false;
  if (record) startRecording();
  updateTourButton();
}

// 一人称の開始姿勢を即時に適用(導入の弧の開始点。導入なしなら現在位置から始まるので不要)。
function applyFirstPersonStartPose() {
  if (tour.phase !== "intro") return;
  const a = tour.introA0, R = tour.introR, h = G.eyeY ?? 1.6;
  G.camera.position.set(R * Math.sin(a), h, R * Math.cos(a));
  _look.set(R * 2.0 * Math.sin(a), 1.45, R * 2.0 * Math.cos(a));
  G.camera.lookAt(_look);
}

// 導入フェーズの弧(半径・開始角・掃引角)を決める。終了角を最初の作品の方位に合わせて滑らかに引き継ぐ。
function setupIntroParams(introOn) {
  if (!introOn) return;
  const wb = G.walkBounds || 6;
  const first = tour.stops[0];
  const firstAng = Math.atan2(first.pos.x, first.pos.z);
  if (tour.mode === "third") {
    tour.introR = Math.min(7, Math.max(3, wb * 0.55));
    tour.introSweep = -Math.PI * 1.0;
  } else {
    tour.introR = Math.min(6, Math.max(2.5, wb * 0.5));
    tour.introSweep = -Math.PI * 1.2;
  }
  tour.introA0 = firstAng - tour.introSweep; // 掃引し終えた所が最初の作品の方位になる
}

// アバターモデル(man/girl)を確実に読み込む。読込済み/タイムアウトで解決。
function ensureAvatar() {
  return new Promise((resolve) => {
    const kind = G.charKind || "man";
    if (G.charLoadedKind !== kind || !G.charModel) loadAvatar(kind);
    if (G.charModel && G.mixer) return resolve(true);
    let n = 0;
    const iv = setInterval(() => {
      if (G.charModel && G.mixer) { clearInterval(iv); resolve(true); }
      else if (++n > 120) { clearInterval(iv); resolve(!!G.charModel); } // 約6秒で諦める
    }, 50);
  });
}

// 三人称ツアーの初期配置: アバターを床に立たせ、追従カメラを背後へ即時セット。
function setupThirdStart() {
  G.avatar.visible = true;
  if (G.charPlaceholder) G.charPlaceholder.visible = !G.charModel;
  let sx, sz, facing;
  if (tour.phase === "intro") {
    // 導入の弧の開始点に立たせ、進行方向(接線)を向ける
    const a = tour.introA0;
    sx = tour.introR * Math.sin(a); sz = tour.introR * Math.cos(a);
    const a1 = tour.introA0 + tour.introSweep * 0.03;
    facing = faceYToward(tour.introR * Math.sin(a1) - sx, tour.introR * Math.cos(a1) - sz);
  } else {
    const off = Math.min(3, (G.walkBounds || 6) * 0.4);
    sx = 0; sz = off; facing = Math.PI; // 中心(=最初の作品側)を向く
  }
  G.avatar.position.set(sx, 0, sz);
  G.avatar.rotation.y = facing;
  tour.fromFloor = G.avatar.position.clone();
  if (G.mixer) G.mixer.timeScale = 0;
  if (G.avatarShadow) { G.avatarShadow.visible = true; G.avatarShadow.position.set(sx, 0.02, sz); }
  placeFollowCamera(0, facing, true);
}

// ツアー停止(完走 or 手動)。録画していれば保存される(onstop)。
export function stopTour() {
  if (!tour) return;
  const wasRecording = tour.recording;
  const wasThird = tour.mode === "third";
  const restoreMode = tour.restoreMode;
  tour = null;
  if (G.controls && prevControlsEnabled !== null) {
    G.controls.enabled = prevControlsEnabled;
    G.controls.update?.();
  }
  prevControlsEnabled = null;
  if (wasThird) {
    if (G.mixer) G.mixer.timeScale = 0;          // 歩行アニメを止める
    const keep = restoreMode === "thirdperson";  // 元が三人称でなければアバター/影を隠す
    G.avatar.visible = keep;
    if (G.avatarShadow) G.avatarShadow.visible = keep;
  }
  if (recorder && wasRecording) {
    if (recorder.state !== "inactive") recorder.stop(); // → onstop で保存
    recorder = null;
  }
  hideCaption();              // キャプションをカメラから外す
  restoreCaptureResolution(); // 録画用に下げた描画解像度を元へ戻す
  updateTourButton();
}

export function isTouring() {
  return !!tour;
}

// アバターの向き(rotation.y)。dx,dz の方向を向く。controls.js と同じ流儀。
function faceYToward(dx, dz) {
  return Math.atan2(dx, dz) + (G.charForwardOffset || 0);
}
// 角度 cur を target へ最短弧で maxStep だけ近づける。
function approachAngle(cur, target, maxStep) {
  let d = target - cur;
  d = Math.atan2(Math.sin(d), Math.cos(d)); // -π..π に正規化
  if (Math.abs(d) <= maxStep) return target;
  return cur + Math.sign(d) * maxStep;
}
// 追従カメラをアバター背後へ置く。facingY はアバターの向き。instant=true で即時、false で滑らかに。
const _camDesired = new THREE.Vector3();
const _look = new THREE.Vector3();
function placeFollowCamera(dt, facingY, instant, dist = FOLLOW_DIST) {
  const a = G.avatar.position;
  const fx = Math.sin(facingY), fz = Math.cos(facingY); // アバター前方
  _camDesired.set(a.x - fx * dist, FOLLOW_H, a.z - fz * dist); // 背後へ
  // カメラの半径を [中央什器の外側, 壁の内側] に収める(壁の裏へ抜けて裏面が見える問題を防ぐ)。
  const minR = (G.pedestalR || 0) + 0.8;
  const maxR = (G.walkBounds || 8); // 壁(apothem)より内側に保つ
  const r = Math.hypot(_camDesired.x, _camDesired.z);
  const cr = Math.min(maxR, Math.max(minR, r));
  if (r > 1e-3 && Math.abs(cr - r) > 1e-4) { _camDesired.x *= cr / r; _camDesired.z *= cr / r; }
  const k = instant ? 1 : Math.min(1, dt * 3.0);
  G.camera.position.lerp(_camDesired, k);
  _look.set(a.x + fx * 0.6, 1.3, a.z + fz * 0.6); // アバター前方(作品も画角に入る)
  G.camera.lookAt(_look);
}

// 距離に応じた移動時間を tour.travelDur に入れる(近い絵は短く・遠い絵は長く。一定速度感)。
function setTravelDur(from, to) {
  const d = Math.hypot(to.x - from.x, to.z - from.z);
  tour.travelDur = Math.min(3.6, Math.max(1.3, d / TRAVEL_SPEED));
}

// 三人称ツアー: アバターを経路に沿って歩かせ、カメラが背後を追う。
const _avTarget = new THREE.Vector3();
const _td = new THREE.Vector3();
const _want = new THREE.Vector3();
function updateTourThird(dt) {
  if (!G.avatar.visible) G.avatar.visible = true; // モデル読込のタイミング差で隠れていても確実に出す
  if (G.avatarShadow && !G.avatarShadow.visible) G.avatarShadow.visible = true;

  if (tour.phase === "intro") {
    // 導入: アバターが弧を描いて展示空間を歩き、追従カメラが部屋を見せる
    tour.t = Math.min(1, tour.t + dt / INTRO);
    const a = tour.introA0 + tour.introSweep * tour.t;
    const px = G.avatar.position.x, pz = G.avatar.position.z;
    // 当たり判定経由で動かす(ベンチ等を通り抜けず、ぶつかれば滑る)
    const wx = tour.introR * Math.sin(a), wz = tour.introR * Math.cos(a);
    const [ix, iz] = resolveMove(px, pz, wx - px, wz - pz, 0);
    G.avatar.position.set(ix, 0, iz);
    const dx = ix - px, dz = iz - pz;
    const moving = dx * dx + dz * dz > 1e-7;
    if (moving) G.avatar.rotation.y = faceYToward(dx, dz);
    if (G.mixer) G.mixer.timeScale = moving ? 1 : 0;
    if (G.avatarShadow) G.avatarShadow.position.set(G.avatar.position.x, 0.02, G.avatar.position.z);
    placeFollowCamera(dt, G.avatar.rotation.y, false);
    if (tour.t >= 1) {
      tour.phase = "travel"; tour.t = 0; tour.fromFloor = G.avatar.position.clone();
      setTravelDur(tour.fromFloor, { x: tour.stops[0].pos.x, z: tour.stops[0].pos.z });
    }
    if (G.mixer) G.mixer.update(dt);
    return;
  }

  const stop = tour.stops[tour.i];
  _avTarget.set(stop.pos.x, 0, stop.pos.z); // 立ち位置を床へ落とす
  const a = G.avatar.position;

  if (tour.phase === "travel") {
    if (tour.travelDur == null) setTravelDur(tour.fromFloor, _avTarget);
    tour.t = Math.min(1, tour.t + dt / tour.travelDur);
    const k = easeInOutCubic(tour.t);
    // 目標位置(補間)へ当たり判定経由で進む(什器を通り抜けず、ぶつかれば滑る)
    _want.lerpVectors(tour.fromFloor, _avTarget, k);
    const [nx, nz] = resolveMove(a.x, a.z, _want.x - a.x, _want.z - a.z, 0);
    const mvx = nx - a.x, mvz = nz - a.z;
    a.x = nx; a.z = nz; a.y = 0;
    const moving = mvx * mvx + mvz * mvz > 1e-7;
    if (moving) { _td.set(mvx, 0, mvz).normalize(); G.avatar.rotation.y = faceYToward(_td.x, _td.z); }
    if (G.mixer) G.mixer.timeScale = moving ? 1 : 0; // 歩行アニメ ON/OFF
    if (G.avatarShadow) G.avatarShadow.position.set(a.x, 0.02, a.z); // 影を足元へ
    placeFollowCamera(dt, G.avatar.rotation.y, false);
    if (tour.t >= 1) {
      tour.phase = "dwell"; tour.t = 0;
      if (G.mixer) G.mixer.timeScale = 0;
      tour.faceArt = faceYToward(stop.look.x - a.x, stop.look.z - a.z); // 作品の方を向く目標角
      upgradeArtwork(stop.art);
      drawCaption(stop.art.userData.wallCfg); // 題名・作者のキャプションを用意
    }
  } else {
    // dwell: その場で作品へ向き直り、カメラを少し寄せて鑑賞(過度な首振り防止に旋回は緩め)
    tour.t = Math.min(1, tour.t + dt / DWELL);
    G.avatar.rotation.y = approachAngle(G.avatar.rotation.y, tour.faceArt, (TURN_SPEED * 0.55) * dt);
    if (G.mixer) G.mixer.timeScale = 0;
    const dist = FOLLOW_DIST - (FOLLOW_DIST - 2.4) * easeInOutCubic(tour.t); // 4.0→2.4 へ寄る
    placeFollowCamera(dt, G.avatar.rotation.y, false, dist);
    showCaption(captionOpacity(tour.t)); // 題名を画面下にフェード表示
    if (tour.t >= 1) {
      hideCaption();
      tour.i += 1;
      if (tour.i >= tour.stops.length) { stopTour(); return; }
      tour.phase = "travel"; tour.t = 0; tour.travelDur = null;
      tour.fromFloor = G.avatar.position.clone();
    }
  }
  if (G.mixer) G.mixer.update(dt); // アニメを進める
}

const _ahead = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _qStroll = new THREE.Quaternion();
// 毎フレーム呼ばれる。カメラを現在のセグメントに沿って動かす。
export function updateTour(dt) {
  if (!tour) return;
  if (tour.mode === "third") { updateTourThird(dt); return; }

  if (tour.phase === "intro") {
    // 導入: 部屋の内側をゆっくり弧で回り、壁の作品群を見渡す(外側を向く)
    tour.t = Math.min(1, tour.t + dt / INTRO);
    const k = easeInOutCubic(tour.t);
    const a = tour.introA0 + tour.introSweep * k;
    const h = G.eyeY ?? 1.6, R = tour.introR;
    G.camera.position.set(R * Math.sin(a), h, R * Math.cos(a));
    _look.set(R * 2.0 * Math.sin(a), 1.45, R * 2.0 * Math.cos(a)); // 外側(壁の作品)を見る
    G.camera.lookAt(_look);
    if (tour.t >= 1) {
      tour.phase = "travel"; tour.t = 0; tour.travelDur = null;
      tour.fromPos = G.camera.position.clone();
      tour.fromQuat = G.camera.quaternion.clone();
    }
    return;
  }

  const stop = tour.stops[tour.i];

  if (tour.phase === "travel") {
    if (tour.travelDur == null) setTravelDur(tour.fromPos, stop.pos);
    tour.t = Math.min(1, tour.t + dt / tour.travelDur);
    const k = easeInOutCubic(tour.t);
    G.camera.position.lerpVectors(tour.fromPos, stop.pos, k);

    // 視線: 移動中は進行方向を向いて歩き、到着間際に作品へ向き直る(凝視ワープ感を消す)。
    _dir.copy(stop.pos).sub(tour.fromPos); _dir.y = 0;
    if (_dir.lengthSq() < 1e-6) _dir.set(0, 0, -1);
    _dir.normalize();
    _ahead.copy(G.camera.position).addScaledVector(_dir, 2.5); _ahead.y = G.camera.position.y;
    _qStroll.copy(quatLookingAt(G.camera.position, _ahead));
    if (tour.t < 0.25) {
      // 出だしは前セグメントの向きから進行方向へ滑らかに(急な振り向きを防ぐ)
      G.camera.quaternion.slerpQuaternions(tour.fromQuat, _qStroll, easeInOutCubic(tour.t / 0.25));
    } else if (tour.t < TURN_AT) {
      G.camera.quaternion.copy(_qStroll);
    } else {
      // 残りで作品の正面姿勢へ向き直る
      G.camera.quaternion.slerpQuaternions(_qStroll, stop.quat, easeInOutCubic((tour.t - TURN_AT) / (1 - TURN_AT)));
    }
    if (tour.t >= 1) {
      tour.phase = "dwell"; tour.t = 0;
      upgradeArtwork(stop.art); // 寄る前に高精細タイルを要求(到着時には鮮明に)
      drawCaption(stop.art.userData.wallCfg); // 題名・作者のキャプションを用意
    }
    return;
  }

  // dwell: 作品へゆっくり寄る(ズームイン)。寄りで見上げ角が変わるので毎フレーム作品を見続ける。
  tour.t = Math.min(1, tour.t + dt / DWELL);
  const k = easeInOutCubic(tour.t);
  G.camera.position.lerpVectors(stop.pos, stop.posNear, k);
  G.camera.lookAt(stop.look);
  showCaption(captionOpacity(tour.t)); // 題名を画面下にフェード表示(録画にも映る)
  if (tour.t >= 1) {
    hideCaption();
    // 次の作品へ。現在の姿勢を次セグメントの起点にする(連続した動きにする)。
    tour.i += 1;
    if (tour.i >= tour.stops.length) { stopTour(); return; }
    tour.phase = "travel";
    tour.t = 0; tour.travelDur = null;
    tour.fromPos = G.camera.position.clone();
    tour.fromQuat = G.camera.quaternion.clone();
  }
}

// UI: 一人称ツアー / 三人称ツアーの開始・停止ボタンを配線する。
export function setupTourUI() {
  const btnF = $("#tour-toggle");      // 一人称
  const btn3 = $("#tour-toggle-3p");   // 三人称(アバターが歩く)
  if (!btnF && !btn3) return;
  const onClick = (mode) => () => {
    if (tour) stopTour();
    else startTour({ record: true, mode }); // startTour 内で updateTourButton を呼ぶ
  };
  btnF?.addEventListener("click", onClick("first"));
  btn3?.addEventListener("click", onClick("third"));

  // ギャラリー入室中だけ表示(入口では隠す) — quality-toggle と同じ仕組み
  const entrance = $("#entrance");
  if (entrance) {
    const sync = () => {
      const show = !entrance.classList.contains("show");
      btnF?.classList.toggle("show", show);
      btn3?.classList.toggle("show", show);
    };
    new MutationObserver(sync).observe(entrance, { attributes: true, attributeFilter: ["class"] });
    sync();
  }
  updateTourButton();
}

// 2つのボタンの表示を更新。実行中はその方式のボタンを「停止」に、もう一方は無効化する。
function updateTourButton() {
  const btnF = $("#tour-toggle");
  const btn3 = $("#tour-toggle-3p");
  const active = tour ? tour.mode : null; // "first" | "third" | null
  if (btnF) {
    const isActive = active === "first";
    btnF.textContent = isActive ? t("tourStop") : t("tourFirst");
    btnF.classList.toggle("recording", isActive);
    btnF.disabled = !!tour && !isActive;
  }
  if (btn3) {
    const isActive = active === "third";
    btn3.textContent = isActive ? t("tourStop") : t("tourThird");
    btn3.classList.toggle("recording", isActive);
    btn3.disabled = !!tour && !isActive;
  }
}
