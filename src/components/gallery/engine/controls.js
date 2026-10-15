// controls.js — 操作系。見回す(OrbitControls)/一人称で歩く(PointerLock+WASD)の2モード、
// ホバー判定、クリック時の挙動(前進アニメ or 視点ロック)、毎フレーム更新を担う。

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";
import { G, $, IDLE_MS, easeInOutCubic, labelHtml } from "./state.js";
import { openViewer, isOverlayOpen } from "./viewer.js";
import { loadAvatar } from "./avatar.js";
import { makeShadow } from "./room.js";
import { t } from "./i18n.js";

const CENTER = new THREE.Vector2(0, 0);
const _rayOrig = new THREE.Vector3();
const _rayDir = new THREE.Vector3();
const CAM_FOLLOW = 3.0; // 三人称: カメラがアバター背後へ回り込む速さ(大きいほど速い)

export function setupControls() {
  const cam = G.cfg.camera || {};
  G.eyeY = G.cfg.polygon?.eyeHeight ?? 1.6;

  G.controls = new OrbitControls(G.camera, G.renderer.domElement);
  G.controls.enableDamping = true;
  G.controls.dampingFactor = 0.08;
  G.controls.minDistance = cam.minDistance ?? 0.5;
  G.controls.maxDistance = cam.maxDistance ?? 40;
  G.controls.maxPolarAngle = Math.PI * 0.92;
  G.controls.autoRotateSpeed = G.cfg.autoRotateSpeed ?? 0.6;
  G.controls.target.set(0, G.eyeY, 0);
  G.controls.update();
  G.controls.addEventListener("start", () => {
    G.controls.autoRotate = false;
    if (G.idleTimer) clearTimeout(G.idleTimer);
  });
  G.controls.addEventListener("end", () => {
    if (G.idleTimer) clearTimeout(G.idleTimer);
    G.idleTimer = setTimeout(() => {
      if (G.mode === "orbit" && !G.flight && !isOverlayOpen())
        G.controls.autoRotate = G.cfg.autoRotate !== false;
    }, IDLE_MS);
  });

  // 三人称用のアバター(常設・既定は非表示)。リグなしの簡易フィギュア。
  G.avatar = makeAvatar();
  G.avatar.visible = false;
  G.scene.add(G.avatar);
  G.baseMinDistance = G.controls.minDistance;

  G.walkControls = new PointerLockControls(G.camera, G.renderer.domElement);
  G.walkControls.addEventListener("lock", () => {
    $("#walk-prompt").classList.remove("show");
    $("#crosshair").classList.add("show");
  });
  G.walkControls.addEventListener("unlock", () => {
    $("#crosshair").classList.remove("show");
    if (G.mode === "walk" && !isOverlayOpen()) $("#walk-prompt").classList.add("show");
  });

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  G.renderer.domElement.addEventListener("pointermove", onPointerMove);
  G.renderer.domElement.addEventListener("click", onClick);
  $("#mode-toggle").addEventListener("click", () => setMode(G.mode === "orbit" ? "walk" : "orbit"));
  $("#walk-prompt").addEventListener("click", () => {
    if (G.mode === "walk") G.walkControls.lock();
  });
  // 拡大は明示操作のみ: 見回しは🔍ボタン、歩行は E キー(誤クリックで開かない)
  $("#hud-zoom").addEventListener("click", (e) => {
    e.stopPropagation();
    zoomFocused();
  });
  setupJoystick();
}

// --- バーチャルコントローラ(スマホ用) ---
function joystickEnabled() {
  const v = G.cfg.virtualController || "auto";
  if (v === "off") return false;
  if (v === "always") return true;
  return "ontouchstart" in window || navigator.maxTouchPoints > 0; // auto: タッチ端末のみ
}

function setupJoystick() {
  if (!joystickEnabled()) return;
  const base = $("#joystick");
  const knob = $("#joystick-knob");
  const R = 46;
  let active = false, id = null;
  const reset = () => {
    active = false;
    knob.style.transform = "translate(-50%, -50%)";
    G.move.f = G.move.b = G.move.l = G.move.r = false;
  };
  const apply = (e) => {
    const r = base.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    const len = Math.hypot(dx, dy) || 1;
    const cl = Math.min(len, R);
    knob.style.transform = `translate(calc(-50% + ${(dx / len) * cl}px), calc(-50% + ${(dy / len) * cl}px))`;
    const nx = dx / R, ny = dy / R; // ny: 下が正
    G.move.f = ny < -0.35;
    G.move.b = ny > 0.35;
    G.move.l = nx < -0.35;
    G.move.r = nx > 0.35;
  };
  base.addEventListener("pointerdown", (e) => { active = true; id = e.pointerId; base.setPointerCapture(id); apply(e); });
  base.addEventListener("pointermove", (e) => { if (active && e.pointerId === id) apply(e); });
  base.addEventListener("pointerup", (e) => { if (e.pointerId === id) reset(); });
  base.addEventListener("pointercancel", () => reset());
}

function showJoystick(on) {
  const el = $("#joystick");
  if (!el) return;
  el.classList.toggle("show", on && joystickEnabled());
}

// 選択中の作品を拡大表示する(見回しは近づいてから、歩行はその場で開く)
function zoomFocused() {
  const art = G.focused;
  if (!art) return;
  if (G.mode === "orbit") {
    if (!G.flight) startFlight(art); // 見回しモードだけ近づいてから開く
  } else {
    // 一人称/三人称: その場で開く(カメラを動かさない=戻った時にずれない)
    if (G.mode === "walk") G.walkControls.unlock();
    openViewer(art.userData.wallCfg, art.userData.resolved);
  }
}

// 目次などから任意の作品を選択→拡大する。選択ハイライトを移してから zoomFocused と同じ挙動。
export function focusAndZoom(art) {
  if (!art) return;
  if (G.focused && G.focused !== art) G.focused.userData.frame.material.emissive?.setHex(0x000000);
  G.focused = art;
  art.userData.frame.material.emissive?.setHex(0x1a1408);
  zoomFocused();
}

export function setMode(next) {
  if (next === G.mode) return;
  // 退出処理(共通)
  G.walkControls.unlock();
  G.avatar.visible = false;
  if (G.avatarShadow) G.avatarShadow.visible = false;
  $("#walk-prompt").classList.remove("show");
  $("#crosshair").classList.remove("show");
  if (G.idleTimer) clearTimeout(G.idleTimer);

  G.mode = next;
  G.hovered = null;
  clearFocus();
  G.feetY = 0; G.vy = 0; G.grounded = true; // 物理リセット

  if (G.mode === "walk") {
    G.controls.autoRotate = false;
    G.controls.enabled = false;
    const woff = Math.min(3, (G.walkBounds || 6) * 0.4); // 中央の台座を避けてスポーン
    G.camera.position.set(0, G.eyeY, woff);
    $("#mode-toggle").textContent = t("toLook");
    $("#walk-prompt").classList.add("show");
    document.body.style.cursor = "";
  } else if (G.mode === "thirdperson") {
    // 追従カメラ + アバター。OrbitControls で見回し、WASD でアバターを移動。
    G.controls.autoRotate = false;
    G.controls.enabled = true;
    G.controls.minDistance = 1.5;
    // 選択された man/girl をまだ読み込んでいなければ読み込む
    const kind = G.charKind || "man";
    if (G.charLoadedKind !== kind) loadAvatar(kind);
    // 中央の台座と重ならないよう、壁寄りにスポーン
    const off = Math.min(3, (G.walkBounds || 6) * 0.4);
    G.avatar.position.set(0, 0, off);
    G.avatar.rotation.y = Math.PI; // 中心(=作品)側を向く
    G.avatar.visible = true;
    G.controls.target.set(0, 1.1, off);
    G.camera.position.set(0, 2.2, off + 6.5);
    G.controls.update();
    $("#mode-toggle").textContent = t("toLook");
  } else {
    G.controls.enabled = true;
    G.controls.minDistance = G.baseMinDistance;
    G.controls.target.set(0, G.eyeY, 0);
    G.controls.update();
    $("#mode-toggle").textContent = t("toWalk");
  }
  showJoystick(G.mode === "walk" || G.mode === "thirdperson");
}

// 三人称アバターの入れ物(モデルは loadAvatar で man/girl を後から読み込む)。
function makeAvatar() {
  const g = new THREE.Group();
  G.charForwardOffset = G.cfg.characterForwardOffset ?? 0;
  // VRM(unlit)でも環境次第で暗くならないよう、追従フィル光(1灯・コスト一定)
  const fill = new THREE.PointLight(0xfff2e0, 3.5, 8, 2);
  fill.position.set(0, 2.4, 1.4);
  g.add(fill);
  // 接地影(床に残す。ジャンプで上下しないよう avatar の子にはしない)
  G.avatarShadow = makeShadow(1.0, 0.5);
  G.avatarShadow.visible = false;
  G.scene.add(G.avatarShadow);
  return g;
}

// 歩行/待機の切替。VRM は idle クリップが無いので timeScale で停止/再生。
function setCharAnim(moving) {
  if (!G.mixer || !G.actWalk) return;
  if (!G.actIdle) {
    G.mixer.timeScale = moving ? 1 : 0; // VRM: 歩行クリップを止める/動かす
    return;
  }
  if (moving === G.charMoving) return;
  G.charMoving = moving;
  const to = moving ? G.actWalk : G.actIdle;
  const from = moving ? G.actIdle : G.actWalk;
  to.enabled = true;
  to.setEffectiveTimeScale(1);
  to.crossFadeFrom(from, 0.25, false);
  to.setEffectiveWeight(1);
}

const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _delta = new THREE.Vector3();
export function updateThirdPerson(dt) {
  if (G.mode !== "thirdperson") {
    if (G.mixer) G.mixer.update(dt); // 念のため(非表示時は描画されない)
    return;
  }
  const speed = G.cfg.walkSpeed ?? 5.5;
  const dz = (G.move.f ? 1 : 0) - (G.move.b ? 1 : 0);
  const dx = (G.move.r ? 1 : 0) - (G.move.l ? 1 : 0);
  const a = G.avatar.position;
  let moving = false;
  if (dz || dx) {
    G.camera.getWorldDirection(_fwd);
    _fwd.y = 0;
    _fwd.normalize();
    _right.set(-_fwd.z, 0, _fwd.x); // 右方向(= forward × up)。カメラが-Z向きで画面右=+X
    _delta.set(0, 0, 0).addScaledVector(_fwd, dz).addScaledVector(_right, dx);
    if (_delta.lengthSq() > 0) {
      _delta.normalize().multiplyScalar(speed * dt);
      const [nx, nz] = resolveMove(a.x, a.z, _delta.x, _delta.z, G.feetY);
      const mx = nx - a.x, mz = nz - a.z;
      a.x = nx; a.z = nz;
      // ターゲットとカメラを同じだけ動かして追従(視点の向きは保つ)
      G.controls.target.x += mx; G.controls.target.z += mz;
      G.camera.position.x += mx; G.camera.position.z += mz;
      G.avatar.rotation.y = Math.atan2(_delta.x, _delta.z) + (G.charForwardOffset || 0);
      moving = Math.hypot(mx, mz) > 1e-5;
      // カメラをアバターの背後へ滑らかに回り込ませる(常に背中が見え、A/Dが画面の左右と一致)。
      // 前後成分があるときだけ。純粋な横歩き(dz=0)では視界を振らない。
      if (dz) {
        const fx = Math.sin(G.avatar.rotation.y), fz = Math.cos(G.avatar.rotation.y); // アバター前方
        const tx = G.controls.target.x, tz = G.controls.target.z;
        const cdx = G.camera.position.x - tx, cdz = G.camera.position.z - tz;
        const dist = Math.hypot(cdx, cdz) || 6.5; // 現在の距離を保つ
        const desX = tx - fx * dist, desZ = tz - fz * dist; // 背後の位置
        const k = Math.min(1, dt * CAM_FOLLOW);
        G.camera.position.x += (desX - G.camera.position.x) * k;
        G.camera.position.z += (desZ - G.camera.position.z) * k;
      }
    }
  }
  stepVertical(dt, a.x, a.z); // 重力/ジャンプ → 足元の高さ
  a.y = G.feetY;
  if (G.avatarShadow) { // 影は床に残し、ジャンプで薄く大きく
    G.avatarShadow.position.set(a.x, 0.02, a.z);
    const s = 1 + G.feetY * 0.25;
    G.avatarShadow.scale.set(s, s, 1);
    G.avatarShadow.material.opacity = Math.max(0.12, 0.5 - G.feetY * 0.12);
  }
  setCharAnim(moving);
  if (G.mixer) G.mixer.update(dt);
}

function onKeyDown(e) {
  if (e.code === "KeyE" && G.focused &&
      ((G.mode === "walk" && G.walkControls.isLocked) || G.mode === "thirdperson")) {
    zoomFocused(); // 歩行/三人称: 正面の作品を E で拡大
    return;
  }
  if (G.mode !== "walk" && G.mode !== "thirdperson") return;
  switch (e.code) {
    case "KeyW": case "ArrowUp": G.move.f = true; break;
    case "KeyS": case "ArrowDown": G.move.b = true; break;
    case "KeyA": case "ArrowLeft": G.move.l = true; break;
    case "KeyD": case "ArrowRight": G.move.r = true; break;
    case "Space": e.preventDefault(); tryJump(); break; // スペースでジャンプ
  }
}
function onKeyUp(e) {
  switch (e.code) {
    case "KeyW": case "ArrowUp": G.move.f = false; break;
    case "KeyS": case "ArrowDown": G.move.b = false; break;
    case "KeyA": case "ArrowLeft": G.move.l = false; break;
    case "KeyD": case "ArrowRight": G.move.r = false; break;
  }
}

// ── 簡易物理: 什器の当たり判定 + 重力/ジャンプ ──────────────────
const GRAVITY = 18, JUMP_SPEED = 6.2;

function footprintContains(c, x, z) {
  if (c.kind === "cyl") return Math.hypot(x - c.x, z - c.z) <= c.r;
  const dx = x - c.x, dz = z - c.z;
  const cs = Math.cos(-c.rotY), sn = Math.sin(-c.rotY);
  return Math.abs(dx * cs - dz * sn) <= c.hx && Math.abs(dx * sn + dz * cs) <= c.hz;
}
// その高さでその位置に入れない(箱の側面)か
function blockedAt(x, z, feetY) {
  for (const c of G.colliders) if (footprintContains(c, x, z) && feetY < c.top - 0.05) return true;
  return false;
}
// その位置の地面高さ(箱の上 or 床0)
function groundAt(x, z) {
  let g = 0;
  for (const c of G.colliders) if (footprintContains(c, x, z) && c.top > g) g = c.top;
  return g;
}
// 水平移動を解決(ぶつかったら軸ごとに滑る)。壁(walkBounds)内にも収める。
// tour.js の三人称ツアーでもアバターの当たり判定に再利用する。
// 見回し・三人称のカメラが壁や天井を突き抜けないよう、部屋の内側に留める。
// 注視点(部屋の中)からカメラへ向かう線上で、壁の手前まで引き戻す(三人称ゲームのカメラと同じ)。
// 壁も絵も表側しか描かないので、外へ出ると壁が透けて額縁の裏や空の枠が見えてしまう。
const CAM_WALL_MARGIN = 0.35; // 壁(額縁の厚み込み)からの余白 m
export function clampCameraToRoom() {
  const r = G.roomShape;
  if (!r) return;
  const cam = G.camera.position, tg = G.controls.target;
  const lim = r.apothem - CAM_WALL_MARGIN;
  let k = 1; // 注視点→カメラの何割まで進めるか
  for (const a of r.angles) {
    const nx = Math.sin(a), nz = Math.cos(a); // 壁の外向き法線
    const dt = tg.x * nx + tg.z * nz;
    const dc = cam.x * nx + cam.z * nz;
    if (dc > lim && dt < lim) k = Math.min(k, (lim - dt) / (dc - dt));
  }
  const top = r.height - CAM_WALL_MARGIN, bottom = 0.2;
  if (cam.y > top && tg.y < top) k = Math.min(k, (top - tg.y) / (cam.y - tg.y));
  if (cam.y < bottom && tg.y > bottom) k = Math.min(k, (tg.y - bottom) / (tg.y - cam.y));
  if (k < 1) cam.lerpVectors(tg, cam, Math.max(0, k));
}

export function resolveMove(px, pz, dx, dz, feetY) {
  let nx = px + dx, nz = pz + dz;
  if (blockedAt(nx, nz, feetY)) {
    if (!blockedAt(px + dx, pz, feetY)) { nx = px + dx; nz = pz; }
    else if (!blockedAt(px, pz + dz, feetY)) { nx = px; nz = pz + dz; }
    else { nx = px; nz = pz; }
  }
  const r = Math.hypot(nx, nz);
  if (r > G.walkBounds) { nx *= G.walkBounds / r; nz *= G.walkBounds / r; }
  return [nx, nz];
}
function stepVertical(dt, x, z) {
  G.vy -= GRAVITY * dt;
  G.feetY += G.vy * dt;
  const g = groundAt(x, z);
  if (G.feetY <= g) { G.feetY = g; G.vy = 0; G.grounded = true; }
  else G.grounded = false;
}
export function tryJump() {
  if (G.grounded) { G.vy = JUMP_SPEED; G.grounded = false; }
}

export function updateWalk(dt) {
  if (G.mode !== "walk" || (!G.walkControls.isLocked && !window.__forceWalk)) return;
  const speed = G.cfg.walkSpeed ?? 5.5;
  const p = G.camera.position;
  const dz = (G.move.f ? 1 : 0) - (G.move.b ? 1 : 0);
  const dx = (G.move.r ? 1 : 0) - (G.move.l ? 1 : 0);
  if (dz || dx) {
    G.camera.getWorldDirection(_fwd); _fwd.y = 0; _fwd.normalize();
    _right.set(-_fwd.z, 0, _fwd.x); // 右方向(= forward × up)
    _delta.set(0, 0, 0).addScaledVector(_fwd, dz).addScaledVector(_right, dx);
    if (_delta.lengthSq() > 0) {
      _delta.normalize().multiplyScalar(speed * dt);
      const [nx, nz] = resolveMove(p.x, p.z, _delta.x, _delta.z, G.feetY);
      p.x = nx; p.z = nz;
    }
  }
  stepVertical(dt, p.x, p.z);
  p.y = G.feetY + G.eyeY; // 目線は足元の上
}

function onPointerMove(e) {
  // 描画領域がページの一部なので、領域の左上からの位置で測る
  const r = G.renderer.domElement.getBoundingClientRect();
  G.pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  G.pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
}

export function updateHover() {
  if (G.flight) return;
  if (G.mode === "walk" && !G.walkControls.isLocked) return;
  // 見回し=マウス位置 / 一人称=画面中央 / 三人称=アバター頭からカメラ正面(水平)方向へ。
  // 三人称はカメラがアバターを見下ろすため画面中央レイは床に当たる。向いた壁の作品を狙えるよう、
  // アバターの頭の高さ・水平方向にレイを飛ばす(操作性も向上)。移動/旋回に追従して対象が切り替わる。
  const useCenter = G.mode !== "orbit";
  if (G.mode === "thirdperson" && G.avatar) {
    _rayOrig.copy(G.avatar.position);
    _rayOrig.y += G.cfg.room?.hangCenter ?? 1.55; // 作品の中心高さ
    G.camera.getWorldDirection(_rayDir);
    _rayDir.y = 0;
    if (_rayDir.lengthSq() < 1e-6) _rayDir.set(0, 0, -1);
    _rayDir.normalize();
    G.raycaster.set(_rayOrig, _rayDir);
  } else {
    G.raycaster.setFromCamera(useCenter ? CENTER : G.pointer, G.camera);
  }
  const hit = G.raycaster.intersectObjects(G.pickables, false)[0]?.object || null;
  if (hit !== G.hovered) {
    G.hovered = hit;
    if (hit) setFocus(hit);
    else if (useCenter) clearFocus(); // 歩行/三人称は正面に作品が無ければ解除
    // 見回しは外れても focus を保持(🔍ボタンへマウスを動かせるように)
  }
}

function setFocus(art) {
  if (G.focused && G.focused !== art) G.focused.userData.frame.material.emissive?.setHex(0x000000);
  G.focused = art;
  art.userData.frame.material.emissive?.setHex(0x222018);
  const hud = $("#hud");
  const useE = G.mode === "walk" || G.mode === "thirdperson";
  $("#hud-text").innerHTML =
    labelHtml(art.userData.wallCfg) + (useE ? ` <span class="hint">${t("zoomHintE")}</span>` : "");
  $("#hud-zoom").style.display = G.mode === "walk" ? "none" : ""; // 歩行は E キー、見回しはボタン
  hud.classList.add("show");
}

function clearFocus() {
  if (G.focused) G.focused.userData.frame.material.emissive?.setHex(0x000000);
  G.focused = null;
  $("#hud").classList.remove("show");
}

function onClick() {
  // 拡大はしない(誤クリック対策)。見回し=何もしない / 歩行=視点ロックのみ。
  if (G.mode === "walk" && !G.walkControls.isLocked) G.walkControls.lock();
}

// クリックした絵の正面へカメラを滑らかに移動 → 到着したら深ズームを開く
function startFlight(art) {
  const { center, normal, artH, wallCfg, resolved } = art.userData;
  const fov = THREE.MathUtils.degToRad(G.camera.fov);
  const dist = (artH / 2) / Math.tan(fov / 2) * 1.2;
  G.flight = {
    fromPos: G.camera.position.clone(),
    toPos: center.clone().addScaledVector(normal, dist),
    fromTgt: G.controls.target.clone(),
    toTgt: center.clone(),
    t: 0,
    dur: G.cfg.flyDuration ?? 0.9,
    wall: { wallCfg, resolved },
  };
  G.controls.autoRotate = false;
  G.controls.enabled = false;
  if (G.idleTimer) clearTimeout(G.idleTimer);
  $("#hud").classList.remove("show");
}

export function updateFlight(dt) {
  if (!G.flight) return;
  const f = G.flight;
  f.t = Math.min(1, f.t + dt / f.dur);
  const k = easeInOutCubic(f.t);
  G.camera.position.lerpVectors(f.fromPos, f.toPos, k);
  G.controls.target.lerpVectors(f.fromTgt, f.toTgt, k);
  G.camera.lookAt(G.controls.target);
  if (f.t >= 1) {
    G.flight = null;
    openViewer(f.wall.wallCfg, f.wall.resolved);
  }
}
