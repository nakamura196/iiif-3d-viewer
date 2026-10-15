// scene.js — レンダラ・シーン・カメラ・環境光・ポストプロセス(ブルーム)の初期化と画質プリセット。

import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { G, $, viewSize } from "./state.js";

// 暗部バンディング除去の微小ディザ(表示空間で ±1/255 程度の三角分布ノイズ)。
// 空間的に固定(時間項なし)なので録画は決定的のまま。
const DitherShader = {
  uniforms: { tDiffuse: { value: null }, amount: { value: 1.2 / 255 } },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float amount; varying vec2 vUv;
    float rand(vec2 c) { return fract(sin(dot(c, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec4 col = texture2D(tDiffuse, vUv);
      float n = rand(vUv) + rand(vUv + 0.5371) - 1.0; // -1..1 三角分布
      gl_FragColor = vec4(col.rgb + n * amount, col.a);
    }
  `,
};

// quality: high/medium/low に応じて、重い処理(床反射・ブルーム・解像度・天井灯)を段階調整。
// 個別の room.* / bloom.enabled で false にすればプリセットより優先して無効化できる。
export function qualityPreset() {
  const presets = {
    high: { dpr: 2, reflector: 1024, bloom: true, downlights: true, env: true, spotMode: "real" },
    medium: { dpr: 1.5, reflector: 640, bloom: true, downlights: true, env: true, spotMode: "fake" },
    low: { dpr: 1, reflector: 0, bloom: false, downlights: false, env: false, spotMode: "fake" },
  };
  let q = G.cfg.quality;
  if (!q || q === "auto") q = autoQuality();
  G.quality = q;
  const p = { ...(presets[q] || presets.medium) };
  if (G.cfg.maxPixelRatio) p.dpr = G.cfg.maxPixelRatio;
  return p;
}

// 端末性能から high/medium/low を推定(quality 未指定 or "auto" のとき)
function autoQuality() {
  const mem = navigator.deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 4;
  const mobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || navigator.maxTouchPoints > 1;
  if (mobile || mem <= 4 || cores <= 4) return "low";
  if (mem >= 8 && cores >= 8) return "high";
  return "medium";
}

export function setupScene() {
  const room = G.cfg.room || {};
  const bg = new THREE.Color(room.bgColor || "#0a0b0d");
  G.scene = new THREE.Scene();
  G.scene.background = bg;
  const fog = room.fog ?? 0.022;
  if (fog > 0) G.scene.fog = new THREE.FogExp2(bg.getHex(), fog);

  const cam = G.cfg.camera || {};
  const { w: vw, h: vh } = viewSize();
  G.camera = new THREE.PerspectiveCamera(cam.fov || 58, vw / vh, 0.05, 1000);
  const s = cam.start || [0, 1.6, 0.2];
  G.camera.position.set(s[0], s[1], s[2]);

  G.QP = qualityPreset();
  G.renderer = new THREE.WebGLRenderer({ antialias: true });
  G.renderer.setPixelRatio(Math.min(window.devicePixelRatio, G.QP.dpr));
  G.renderer.setSize(vw, vh);
  G.renderer.toneMapping = THREE.ACESFilmicToneMapping;
  G.renderer.toneMappingExposure = room.exposure ?? 1.1;
  $("#scene").appendChild(G.renderer.domElement);

  // 暗い室内: 弱い環境光。明かりは作品スポット(+擬似グロー)で作る。
  G.scene.add(new THREE.AmbientLight(0xffffff, room.ambient ?? 0.08));
  G.scene.add(new THREE.HemisphereLight(0x556070, 0x101015, room.hemi ?? 0.12));

  // 環境マップ(IBL): PBRの陰影・質感を底上げしてリアリティを回復(生成は一度きり・低コスト)。
  // 暗い雰囲気を保つため materials 側の envMapIntensity を低めにする(room.js)。
  if (G.QP.env) {
    const pmrem = new THREE.PMREMGenerator(G.renderer);
    // three r163 以降の RoomEnvironment は中の点光源を常に 900 で作る。元(r160、renderer を渡さない呼び方)
    // は 5 だったので、そのままだと室内が明るくなりすぎる。元の明るさに戻す
    const roomEnv = new RoomEnvironment();
    roomEnv.traverse((o) => { if (o.isPointLight) o.intensity = 5; });
    G.scene.environment = pmrem.fromScene(roomEnv, 0.04).texture;
    G.envOn = true;
  }

  G.raycaster = new THREE.Raycaster();
  G.galleryRoot = new THREE.Group();
  G.scene.add(G.galleryRoot);

  window.addEventListener("resize", onResize);
}

export function setupPostprocessing() {
  const b = G.cfg.bloom || {};
  G.composer = new EffectComposer(G.renderer);
  G.composer.addPass(new RenderPass(G.scene, G.camera));
  if (b.enabled !== false && G.QP.bloom) {
    G.composer.addPass(
      new UnrealBloomPass(
        new THREE.Vector2(viewSize().w, viewSize().h),
        b.strength ?? 0.5,
        b.radius ?? 0.5,
        b.threshold ?? 0.85
      )
    );
  }
  G.composer.addPass(new OutputPass()); // トーンマッピング + sRGB 出力

  // 暗い室内のグラデーション(霧・光のプール)は 8bit 出力で縞(バンディング)が出やすく、
  // 動画圧縮で更に目立つ。表示空間(sRGB)で微小な三角ノイズ・ディザを足して縞を崩す。
  G.composer.addPass(new ShaderPass(DitherShader));

  // EffectComposer 経由だと renderer の antialias(MSAA)が効かない(描画先が独自RT)。
  // WebGL2 では RT を multisample 化できる。額縁・什器の細い高コントラスト境界の
  // ジャギ/ちらつき(動画圧縮で悪化)を抑える。低コスト。
  const samples = G.QP.msaa ?? 4;
  if (samples > 0 && G.renderer.capabilities.isWebGL2) {
    if (G.composer.renderTarget1) G.composer.renderTarget1.samples = samples;
    if (G.composer.renderTarget2) G.composer.renderTarget2.samples = samples;
  }
}

export function onResize() {
  if (!G.renderer || !G.composer) return;
  const { w, h } = viewSize();
  G.camera.aspect = w / h;
  G.camera.updateProjectionMatrix();
  G.renderer.setSize(w, h);
  G.composer.setSize(w, h);
}
