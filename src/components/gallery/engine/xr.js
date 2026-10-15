// xr.js — WebXR(VR)対応。Enter VR ボタン、プレイヤー用ドリー(rig)、コントローラのスティック移動。
// XR 中はポストプロセス(ブルーム等)を使わず renderer.render で直接描画する(EffectComposer は XR 非対応)。

import * as THREE from "three";
import { VRButton } from "three/examples/jsm/webxr/VRButton.js";
import { G, $ } from "./state.js";
import { t } from "./i18n.js";

let dolly = null;
let controllers = [];
let helpPanel = null;     // VR 入室直後に出す操作ヒント(ヘッドセット内では DOM が見えないため 3D 板で表示)
let helpFade = 0;         // 残り表示秒数(0 で消す)
let aimLines = [];        // 各コントローラの照準線(望遠鏡を向ける補助)

export function setupXR() {
  if (G.cfg.xr === false) return;
  G.renderer.xr.enabled = true;

  // プレイヤー rig(これを動かして移動する)。XR 中だけカメラをこの配下に入れる。
  dolly = new THREE.Group();
  dolly.name = "xr-dolly";
  G.xrDolly = dolly;

  controllers = [0, 1].map((i) => {
    const c = G.renderer.xr.getController(i);
    dolly.add(c);
    // 照準線(望遠鏡を向ける補助)。作品に当たると明るくなる。
    const line = makeAimLine();
    c.add(line);
    aimLines.push(line);
    // トリガで「覗き込み拡大」: 引いている間だけ前方に高精細クロップを表示
    c.addEventListener("selectstart", () => onSelectStart(c));
    c.addEventListener("selectend", closeMagnifier);
    return c;
  });

  // Enter VR ボタンは WebXR が実際に使える時だけ表示(非対応の "VR NOT SUPPORTED" は出さない)
  if (navigator.xr && navigator.xr.isSessionSupported) {
    navigator.xr.isSessionSupported("immersive-vr").then((ok) => {
      if (!ok) return;
      const btn = VRButton.createButton(G.renderer);
      btn.id = "vr-button";
      btn.classList.add("vr-hidden"); // 既定は隠す(ロビー/初回ロード中に一瞬でも出さない)
      (G.root || document.body).appendChild(btn);
      gateVrButtonToGallery(btn);
    }).catch(() => {});
  }

  G.renderer.xr.addEventListener("sessionstart", onSessionStart);
  G.renderer.xr.addEventListener("sessionend", onSessionEnd);
}

// 入口(ロビー)は 3D の部屋が空(clearGallery 済み)なので、そのまま VR に入ると真っ暗になる。
// 標準の Enter VR は「展示室に入っている時だけ」出す。ロビーからの VR 入室は専用ボタン
// (#entrance-enter-vr → enterVR)に一本化し、そちらが展示室を組み立ててから没入させる。
//
// 判定には #entrance-back(← 入口に戻るボタン)の .show を使う。これは展示室に入った時だけ
// 付き、ロビーでも初回ロード中(まだ #entrance に .show が付く前)でも付かないため、
// 「ギャラリー在室」の確実なシグナルになる。#entrance.show は初回ロード中の窓で
// 一瞬ロビー判定を外し、標準ボタンが出てしまっていた。
// VRButton はインライン style で display を制御するため、隠す側は !important クラスで上書きする。
function gateVrButtonToGallery(btn) {
  const back = $("#entrance-back");
  if (!back) return;
  const sync = () => btn.classList.toggle("vr-hidden", !back.classList.contains("show"));
  new MutationObserver(sync).observe(back, { attributes: true, attributeFilter: ["class"] });
  sync();
}

function onSessionStart() {
  // カメラを dolly 配下へ。ヘッドセットが頭の姿勢を、dolly が立ち位置を担う。
  G.scene.add(dolly);
  dolly.add(G.camera);
  const off = Math.min(3, (G.walkBounds || 6) * 0.5);
  dolly.position.set(0, 0, off);
  dolly.rotation.set(0, 0, 0);
  G.xrPresenting = true;
  // 通常操作とアバターは止める
  if (G.controls) G.controls.enabled = false;
  if (G.avatar) G.avatar.visible = false;
  showVrHelp(); // 入室直後に操作ヒントを数秒表示
}

// 操作ヒントの 3D 板(カメラに追従)。ヘッドセット内では HTML ヘルプが見えないため。
function showVrHelp() {
  helpFade = 6; // 6 秒で自動的に消える
  if (!helpPanel) {
    const canvas = document.createElement("canvas");
    canvas.width = 1024; canvas.height = 256;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "rgba(12,13,16,0.82)";
    roundRect(ctx, 0, 0, 1024, 256, 28); ctx.fill();
    ctx.fillStyle = "#f1ece1";
    ctx.font = "30px -apple-system, 'Hiragino Sans', sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    // 文字列を「　」(全角スペース)区切りで 3 行に折り返す
    const lines = t("vrHelp").split("　");
    const lh = 56, y0 = 128 - ((lines.length - 1) * lh) / 2;
    lines.forEach((ln, i) => ctx.fillText(ln, 512, y0 + i * lh));
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false });
    helpPanel = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.2), mat);
    helpPanel.renderOrder = 999;
  }
  helpPanel.material.opacity = 1;
  G.camera.add(helpPanel);
  helpPanel.position.set(0, -0.18, -0.9); // 視界の少し下、90cm 前
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function onSessionEnd() {
  // カメラをシーン直下に戻し、通常モードに復帰
  closeMagnifier(); // 拡大板を畳む
  if (helpPanel) { G.camera.remove(helpPanel); helpFade = 0; }
  G.scene.add(G.camera);
  G.xrPresenting = false;
  if (G.controls) {
    G.controls.enabled = G.mode === "orbit" || G.mode === "thirdperson";
    G.controls.update();
  }
  if (G.avatar) G.avatar.visible = G.mode === "thirdperson";
}

const _dir = new THREE.Vector3();
const _q = new THREE.Quaternion();
let _turnCooldown = 0;
// XR 中の移動: 左スティックで滑走、右スティックで30°スナップターン
export function updateXR(dt) {
  if (!G.xrPresenting || !dolly) return;
  updateHiRes(dt); // 近寄った作品を高精細タイルに差し替え(VRの「拡大鑑賞」代替)
  updateAim();      // 照準線の見た目(作品に当たると明るく)
  // 操作ヒントを徐々にフェードアウト
  if (helpFade > 0 && helpPanel) {
    helpFade = Math.max(0, helpFade - dt);
    helpPanel.material.opacity = Math.min(1, helpFade); // 最後の 1 秒でフェード
    if (helpFade === 0) G.camera.remove(helpPanel);
  }
  const speed = (G.cfg.walkSpeed ?? 5.5) * 0.7;
  _turnCooldown = Math.max(0, _turnCooldown - dt);

  for (const c of controllers) {
    const isrc = c.userData.inputSource;
    const gp = isrc && isrc.gamepad;
    const src = gp || (c.gamepad ?? null);
    const pad = src || (c.userData.gamepad ?? null);
    const axes = pad?.axes;
    if (!axes || axes.length < 4) continue;
    const x = axes[2] || axes[0] || 0;
    const y = axes[3] || axes[1] || 0;
    if (Math.abs(x) < 0.15 && Math.abs(y) < 0.15) continue;

    // 左右スティックで役割を分ける(標準的な VR 配置)。handedness が無ければ index で代替。
    const hand = isrc?.handedness || (controllers.indexOf(c) === 0 ? "left" : "right");

    if (hand === "right") {
      // 右スティック: 横倒しで 30° スナップターン(VR 酔い対策で連続回転は避ける)。
      // 刻みを細かく+短いクールダウンで、倒し続けるとカチカチ素早く回り「連続的」な体感に近づける。
      if (Math.abs(x) >= 0.7 && _turnCooldown === 0) {
        _q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), x > 0 ? -Math.PI / 6 : Math.PI / 6);
        dolly.quaternion.multiply(_q);
        _turnCooldown = 0.25;
      }
      continue;
    }

    // 左スティック: 前後・左右とも連続滑走(頭の向きを基準に水平移動)
    G.camera.getWorldDirection(_dir);
    _dir.y = 0;
    if (_dir.lengthSq() < 1e-6) continue;
    _dir.normalize();
    const right = new THREE.Vector3(-_dir.z, 0, _dir.x); // right = forward × up（controls.js と同じ符号）
    dolly.position.addScaledVector(_dir, -y * speed * dt);
    dolly.position.addScaledVector(right, x * speed * dt);
    const r = Math.hypot(dolly.position.x, dolly.position.z);
    if (r > G.walkBounds) { dolly.position.x *= G.walkBounds / r; dolly.position.z *= G.walkBounds / r; }
  }
}

// 近づいた作品を IIIF の高精細タイルに差し替える(VR には DOM の深ズームが出せないので、
// 「歩いて近寄ると鮮明になる」体験で代替する)。一度上げた解像度は戻さない(チラつき防止)。
// 距離 → 目標の長辺px。元画像幅を超えない範囲で要求する。
const _head = new THREE.Vector3();
let _hiResAccum = 0;
const HIRES_STEPS = [
  { dist: 2.0, px: 4096 },
  { dist: 3.5, px: 2048 },
];
function updateHiRes(dt) {
  _hiResAccum += dt;
  if (_hiResAccum < 0.25) return; // 4Hz で十分(毎フレームは無駄)
  _hiResAccum = 0;
  if (!G.pickables || !G.pickables.length) return;
  G.camera.getWorldPosition(_head);

  for (const art of G.pickables) {
    const ud = art.userData;
    if (!ud || !ud.resolved || ud._hiResLoading) continue;
    const target = HIRES_STEPS.find((s) => _head.distanceTo(ud.center) <= s.dist);
    if (!target) continue;
    // 元画像の長辺を上限に(region があればその幅)。既にその解像度以上なら何もしない。
    const srcMax = ud.resolved.width || target.px;
    const wantPx = Math.min(target.px, srcMax);
    if ((ud._hiResPx || 0) >= wantPx) continue;

    ud._hiResLoading = true;
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    loader.load(
      ud.resolved.thumb(wantPx),
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = G.renderer.capabilities.getMaxAnisotropy();
        const old = art.material.map;
        art.material.map = tex;
        art.material.color.setHex(0xffffff);
        art.material.needsUpdate = true;
        old?.dispose?.();
        ud._hiResPx = wantPx;
        ud._hiResLoading = false;
      },
      undefined,
      () => { ud._hiResLoading = false; }
    );
  }
}

// ──────────────────────────────────────────────────────────────────────────
// 望遠鏡(覗き込み拡大): コントローラのレイで作品を指してトリガを引くと、
// 当たった一点を中心に IIIF Image API で「その領域だけ」を高精細取得し、
// 目の前の板(カメラ追従)に拡大表示する。full は取らないので巨大画像でも軽く、
// 画像の上部・隅など、近接の高精細化だけでは届かない細部も実解像度で見られる。
// OSD(DOM)は VR では見えないため使わず、WebGL の板テクスチャ差し替えで完結させる。

const RAY_LEN = 6;             // 照準レイの最大長(m)
const CROP_FRAC = 0.18;        // 取り出す領域の一辺(元画像の長辺に対する割合)。小さいほど高倍率
const CROP_PX = 2048;          // サーバに要求する切り出し解像度(長辺px)
const PANEL_SIZE = 0.42;       // 目の前に出す板の一辺(m)
const PANEL_DIST = 0.6;        // 板を出す距離(m)。望遠鏡を覗く距離感

let magnifier = null;          // 拡大表示の板(Mesh)
let _magToken = 0;             // 取得中の世代(離した後に古いロードが差し込むのを防ぐ)
const _rc = new THREE.Raycaster();
const _o = new THREE.Vector3();
const _d = new THREE.Vector3();
const _m = new THREE.Matrix4();

function makeAimLine() {
  const geo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, -RAY_LEN),
  ]);
  const mat = new THREE.LineBasicMaterial({ color: 0x9fb4ff, transparent: true, opacity: 0.25 });
  const line = new THREE.Line(geo, mat);
  line.name = "xr-aim";
  return line;
}

// コントローラの前方へレイを飛ばし、最初に当たった作品とヒット情報を返す
function pickFromController(c) {
  _m.identity().extractRotation(c.matrixWorld);
  _o.setFromMatrixPosition(c.matrixWorld);
  _d.set(0, 0, -1).applyMatrix4(_m).normalize();
  _rc.set(_o, _d);
  _rc.far = RAY_LEN;
  return _rc.intersectObjects(G.pickables, false)[0] || null;
}

function onSelectStart(c) {
  const hit = pickFromController(c);
  if (!hit) return;
  const ud = hit.object.userData;
  if (!ud?.resolved) return;
  const url = cropUrlAt(ud.resolved, hit.uv);
  if (!url) return;

  const token = ++_magToken;
  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin("anonymous");
  loader.load(
    url,
    (tex) => {
      if (token !== _magToken) { tex.dispose(); return; } // 既に離されていれば破棄
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = G.renderer.capabilities.getMaxAnisotropy();
      showMagnifier(tex);
    },
    undefined,
    () => {}
  );
}

// ヒット点の UV(0..1, 左下原点)→ 元画像のピクセル矩形 → IIIF クロップ URL。
// resolved.region があればその領域内での相対座標として扱う(curation の切り抜き作品)。
function cropUrlAt(resolved, uv) {
  if (!uv || !resolved.base) return null; // type:'image'/'dzi' は region 取得不可
  const R = resolved.region;
  const imgW = R ? R.imgW : resolved.width;
  const imgH = R ? R.imgH : resolved.height;
  if (!imgW || !imgH) return null;
  // 表示中の領域(full なら画像全体)
  const vx = R ? R.x : 0, vy = R ? R.y : 0;
  const vw = R ? R.w : imgW, vh = R ? R.h : imgH;
  // UV は左下原点・テクスチャ上下は画像と逆。中心ピクセル(画像座標, 左上原点)へ。
  const cx = vx + uv.x * vw;
  const cy = vy + (1 - uv.y) * vh;
  // 取り出す一辺(元画像の長辺基準)。端でクランプ。
  const side = Math.max(64, Math.round(Math.max(imgW, imgH) * CROP_FRAC));
  let x = Math.round(cx - side / 2);
  let y = Math.round(cy - side / 2);
  x = Math.min(Math.max(0, x), imgW - 1);
  y = Math.min(Math.max(0, y), imgH - 1);
  const w = Math.min(side, imgW - x);
  const h = Math.min(side, imgH - y);
  return `${resolved.base}/${x},${y},${w},${h}/${CROP_PX},/0/default.jpg`;
}

function showMagnifier(tex) {
  if (!magnifier) {
    const mat = new THREE.MeshBasicMaterial({ transparent: true, depthTest: false });
    magnifier = new THREE.Mesh(new THREE.PlaneGeometry(PANEL_SIZE, PANEL_SIZE), mat);
    magnifier.renderOrder = 998;
    // 縁取り(望遠鏡のフレーム感)。少し大きい暗い板を背面に。
    const border = new THREE.Mesh(
      new THREE.PlaneGeometry(PANEL_SIZE * 1.08, PANEL_SIZE * 1.08),
      new THREE.MeshBasicMaterial({ color: 0x0c0d10, transparent: true, opacity: 0.9, depthTest: false })
    );
    border.position.z = -0.001;
    border.renderOrder = 997;
    magnifier.add(border);
  }
  const old = magnifier.material.map;
  magnifier.material.map = tex;
  magnifier.material.needsUpdate = true;
  old?.dispose?.();
  if (magnifier.parent !== G.camera) G.camera.add(magnifier);
  magnifier.position.set(0, 0, -PANEL_DIST); // 視界中央・PANEL_DIST 前方(望遠鏡を覗く位置)
}

function closeMagnifier() {
  _magToken++; // 取得中なら破棄させる
  if (magnifier && magnifier.parent) magnifier.parent.remove(magnifier);
}

// 照準線の見た目を更新(作品に当たっている側を明るく)。updateXR から毎フレーム呼ぶ。
function updateAim() {
  for (let i = 0; i < controllers.length; i++) {
    const line = aimLines[i];
    if (!line) continue;
    const hit = pickFromController(controllers[i]);
    line.material.opacity = hit ? 0.9 : 0.18;
    line.material.color.setHex(hit ? 0xffe9a8 : 0x9fb4ff);
    // レイ長をヒット距離に合わせて縮める(壁を突き抜けて見えないように)
    const len = hit ? hit.distance : RAY_LEN;
    line.scale.z = len / RAY_LEN;
  }
}

// XR セッション中のコントローラ入力ソースを拾えるよう保持
export function bindXRInputSources() {
  controllers.forEach((c) => {
    c.addEventListener("connected", (e) => (c.userData.inputSource = e.data));
    c.addEventListener("disconnected", () => (c.userData.inputSource = null));
  });
}

// VR(immersive-vr)が使えるか。ロビーの「VRで入室」ボタンの活性判定に使う。
export function isVRAvailable() {
  if (G.cfg.xr === false || !navigator.xr?.isSessionSupported) return Promise.resolve(false);
  return navigator.xr.isSessionSupported("immersive-vr").catch(() => false);
}

// ロビーから VR で直接入室する。VR セッション要求はユーザー操作の活性化が要るため、
// クリックハンドラ内から「同期的に」requestSession を呼ぶ必要がある(await を挟む前に発行)。
// 並行してギャラリーを構築し、両方そろってから setSession でセッションを開始する。
// buildFn は展示室を組み立てる非同期関数(成功で resolve)。
export async function enterVR(buildFn) {
  if (!navigator.xr) throw new Error("WebXR unavailable");
  // ① 活性化が生きているうちにセッションを要求(await より前に発行する)
  const sessionPromise = navigator.xr.requestSession("immersive-vr", {
    optionalFeatures: ["local-floor", "bounded-floor", "layers"],
  });
  // ② 並行してギャラリーを構築。失敗したらセッションを畳んで投げ直す
  try {
    await buildFn();
  } catch (err) {
    sessionPromise.then((s) => s.end()).catch(() => {});
    throw err;
  }
  // ③ 両方そろったらセッション開始(sessionstart → onSessionStart で立ち位置を再センタリング)
  const session = await sessionPromise;
  await G.renderer.xr.setSession(session);
}
