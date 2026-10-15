// avatar.js — 三人称用 VRM アバター(man/girl)と Mixamo 歩行アニメのリターゲット。
// nakamura196/iiif-vr の edo-avatar.js の手法を踏襲:
//   retargeted = W_P_src × anim × inv(W_B_src)   (VRM0 は scene.rotation.y=π + (-x,y,-z,w) 反転で補正)
// VRM0 はアニメ無しなので、Mixamo(walk.glb)のクリップを J_Bip_* ボーンへ焼き直して再生する。

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { G } from "./state.js";

const MIXAMO_TO_JBIP = {
  mixamorigHips: "J_Bip_C_Hips", mixamorigSpine: "J_Bip_C_Spine", mixamorigSpine1: "J_Bip_C_Chest",
  mixamorigSpine2: "J_Bip_C_UpperChest", mixamorigNeck: "J_Bip_C_Neck", mixamorigHead: "J_Bip_C_Head",
  mixamorigLeftShoulder: "J_Bip_L_Shoulder", mixamorigLeftArm: "J_Bip_L_UpperArm",
  mixamorigLeftForeArm: "J_Bip_L_LowerArm", mixamorigLeftHand: "J_Bip_L_Hand",
  mixamorigLeftUpLeg: "J_Bip_L_UpperLeg", mixamorigLeftLeg: "J_Bip_L_LowerLeg",
  mixamorigLeftFoot: "J_Bip_L_Foot", mixamorigLeftToeBase: "J_Bip_L_ToeBase",
  mixamorigRightShoulder: "J_Bip_R_Shoulder", mixamorigRightArm: "J_Bip_R_UpperArm",
  mixamorigRightForeArm: "J_Bip_R_LowerArm", mixamorigRightHand: "J_Bip_R_Hand",
  mixamorigRightUpLeg: "J_Bip_R_UpperLeg", mixamorigRightLeg: "J_Bip_R_LowerLeg",
  mixamorigRightFoot: "J_Bip_R_Foot", mixamorigRightToeBase: "J_Bip_R_ToeBase",
};

const loader = new GLTFLoader();
let _mixamo = null;
let _mixamoPromise = null;

// Mixamo(walk.glb)から clip と rest 姿勢(ワールド回転)を一度だけ読む
function loadMixamoData() {
  if (_mixamo) return Promise.resolve(_mixamo);
  if (_mixamoPromise) return _mixamoPromise;
  const url = G.cfg.walkModel || `${G.basePath}/gallery/assets/walk.glb`;
  _mixamoPromise = new Promise((resolve, reject) => {
    loader.load(url, (gltf) => {
      const clip = gltf.animations[0] || null;
      gltf.scene.updateWorldMatrix(true, true);
      const sanitize = (n) => n.replace(/:/g, "");
      const restWorldMap = {};
      const parentMap = {};
      gltf.scene.traverse((node) => {
        if (!node.isBone) return;
        const name = sanitize(node.name);
        restWorldMap[name] = new THREE.Quaternion();
        node.getWorldQuaternion(restWorldMap[name]);
        if (node.parent && node.parent.isBone) {
          parentMap[name] = sanitize(node.parent.name);
        } else if (node.parent) {
          parentMap[name] = "__armature__";
          if (!restWorldMap["__armature__"]) {
            restWorldMap["__armature__"] = new THREE.Quaternion();
            node.parent.getWorldQuaternion(restWorldMap["__armature__"]);
          }
        }
      });
      _mixamo = { clip, restWorldMap, parentMap };
      resolve(_mixamo);
    }, undefined, reject);
  });
  return _mixamoPromise;
}

function buildRetargetedClip(scene, data, isVrm0) {
  const { clip, restWorldMap, parentMap } = data;
  if (!clip) return null;
  const tracks = [];
  const q = new THREE.Quaternion();
  for (const [mb, jb] of Object.entries(MIXAMO_TO_JBIP)) {
    const track = clip.tracks.find((t) => t.name === `${mb}.quaternion`);
    if (!track || !scene.getObjectByName(jb)) continue;
    const W_B = restWorldMap[mb] || new THREE.Quaternion();
    const W_P = parentMap[mb] ? (restWorldMap[parentMap[mb]] || new THREE.Quaternion()) : new THREE.Quaternion();
    const invWB = W_B.clone().invert();
    const raw = track.values;
    const v = new Float32Array(raw.length);
    for (let i = 0; i < raw.length; i += 4) {
      q.set(raw[i], raw[i + 1], raw[i + 2], raw[i + 3]);
      q.premultiply(W_P).multiply(invWB);
      if (isVrm0) { v[i] = -q.x; v[i + 1] = q.y; v[i + 2] = -q.z; v[i + 3] = q.w; }
      else { v[i] = q.x; v[i + 1] = q.y; v[i + 2] = q.z; v[i + 3] = q.w; }
    }
    tracks.push(new THREE.QuaternionKeyframeTrack(`${jb}.quaternion`, track.times, v));
  }
  return tracks.length ? new THREE.AnimationClip("walk", clip.duration, tracks) : null;
}

// 指定の kind(man/girl)を G.avatar(プレースホルダ/前モデルは除去)に読み込む
export function loadAvatar(kind) {
  const url = kind === "girl" ? (G.cfg.girlModel || `${G.basePath}/gallery/assets/girl.glb`) : (G.cfg.manModel || `${G.basePath}/gallery/assets/man.glb`);
  G.charLoadedKind = kind;
  // 既存モデル/ミキサーを片付け(フィル光と将来の差し替えのため group は維持)
  disposeCurrentModel();

  loader.load(
    url,
    async (gltf) => {
      if (G.charLoadedKind !== kind) return; // 途中で切り替わっていたら破棄
      const isVrm0 = (gltf.parser.json.extensionsUsed || []).includes("VRM");
      const scene = gltf.scene;
      if (isVrm0) scene.rotation.y = Math.PI; // VRM0 は -Z 正面 → +Z へ
      scene.scale.setScalar(G.cfg.characterScale ?? 1);
      scene.userData.isCharModel = true;
      // VRM(unlit)の白い服がブルーム閾値を超えて発光するのを抑える:
      // トーンマッピングを効かせ、基色を少し落として高輝度を避ける。
      const dim = G.cfg.charBrightness ?? 0.82;
      scene.traverse((o) => {
        if (!o.isMesh) return;
        for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
          if (!m) continue;
          m.toneMapped = true;
          if (m.color) m.color.multiplyScalar(dim);
          if (m.emissive) m.emissiveIntensity = Math.min(m.emissiveIntensity ?? 1, 0.0);
        }
      });
      // プレースホルダを隠してモデルを出す
      if (G.charPlaceholder) G.charPlaceholder.visible = false;
      G.avatar.add(scene);
      G.charModel = scene;
      try {
        const data = await loadMixamoData();
        const clip = buildRetargetedClip(scene, data, isVrm0);
        if (clip) {
          G.mixer = new THREE.AnimationMixer(scene);
          G.actWalk = G.mixer.clipAction(clip);
          G.actIdle = null; // VRM は idle クリップ無し → timeScale で停止/再生
          G.actWalk.play();
          G.mixer.timeScale = 0;
        }
      } catch (e) {
        console.warn("walk retarget failed:", e?.message || e);
      }
    },
    undefined,
    (err) => console.warn(`avatar load failed (${kind}):`, err?.message || err)
  );
}

function disposeCurrentModel() {
  if (G.mixer) { G.mixer.stopAllAction(); G.mixer = null; }
  G.actWalk = G.actIdle = null;
  if (G.charModel) {
    G.avatar.remove(G.charModel);
    G.charModel.traverse((o) => {
      if (o.isMesh) {
        o.geometry?.dispose?.();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => { m?.map?.dispose?.(); m?.dispose?.(); });
      }
    });
    G.charModel = null;
  }
}
