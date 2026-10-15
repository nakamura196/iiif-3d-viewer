// gallery.js — 展示(部屋+作品)の構築・破棄。ソース(manifest/collection/curation/walls)を
// 壁配列に解決し、G.galleryRoot を作り直す。展示の切替もここを通る。

import { G, $ } from "./state.js";
import { t } from "./i18n.js";
import { resolveSource, loadManifest, loadCollection, loadCuration, loadAuto } from "./iiif.js";
import { layoutWalls, buildRoom, addArtwork } from "./room.js";
import { buildIndex } from "./index.js";

const loading = () => $("#loading");

// 単一ソース → 壁配列に解決
export async function resolveWalls(src) {
  // 入口から入ると #loading は隠れたまま。外部サーバを待つ間も「読み込み中」が見えるよう先に出す
  loading().style.display = "flex";
  if (src.auto) {
    loading().textContent = t("loading");
    return loadAuto(src.auto, { selections: src.selections || null, limit: src.limit ?? 64 });
  }
  if (src.curation) {
    loading().textContent = t("loadingCuration");
    return loadCuration(src.curation, { selections: src.selections || null, limit: src.limit ?? 64 });
  }
  if (src.manifest) {
    loading().textContent = t("loadingManifest");
    return loadManifest(src.manifest, { limit: src.manifestLimit ?? src.limit ?? 24 });
  }
  if (src.collection) {
    loading().textContent = t("loadingCollection");
    return loadCollection(src.collection, { limit: src.collectionLimit ?? src.limit ?? 24 });
  }
  return src.walls || [];
}

export async function buildGalleryFromSource(src, opts = {}) {
  const walls = await resolveWalls(src);
  if (!walls.length) throw new Error(t("noImages"));
  G.entrySource = src; // 画質トグルのリロード後に同じ展示室へ復帰するため記録
  await buildGallery(walls, opts);
}

// 展示の中身を(再)構築。前の展示があれば破棄してから組み立てる。
export async function buildGallery(walls, { resetView = true } = {}) {
  loading().style.display = "flex";
  clearGallery();

  const placements = layoutWalls(walls.length);
  G.walkBounds = Math.max(2, (placements[0]?.apothem || 8) - 0.8);
  buildRoom(placements);

  loading().textContent = `${t("placing")} (0/${walls.length})`;
  let done = 0;
  let firstError = null;
  const arts = new Array(walls.length);
  await Promise.all(
    walls.map(async (w, i) => {
      try {
        const resolved = await resolveSource(w.source);
        arts[i] = addArtwork(w, resolved, placements[i]); // 添字を保って展示順を維持
      } catch (err) {
        console.warn(`wall ${i} (${w.label}) skip:`, err.message);
        firstError ??= err;
      } finally {
        loading().textContent = `${t("placing")} (${++done}/${walls.length})`;
      }
    })
  );
  G.artworks = arts.filter(Boolean); // 解決できた作品を展示順で保持
  // 1 枚も掛けられなかったら、空の部屋ではなく理由を出す（画像サーバが応答しない等）
  if (walls.length && !G.artworks.length) throw firstError || new Error(t("noImages"));
  buildIndex(); // 目次(作品一覧)を作り直す

  if (resetView) resetCamera();
  loading().style.display = "none";
  if (window.__DEBUG) window.__pickables = G.pickables;
}

export function resetCamera() {
  const s = (G.cfg.camera || {}).start || [0, G.eyeY, 0.2];
  G.camera.position.set(s[0], s[1], s[2]);
  G.controls.target.set(0, G.eyeY, 0);
  G.controls.update();
  if (G.mode === "orbit" && G.cfg.autoRotate !== false) G.controls.autoRotate = true;
}

// galleryRoot の中身を破棄(ジオメトリ/マテリアル/テクスチャも解放)
export function clearGallery() {
  G.hovered = null;
  G.pickables.length = 0;
  G.artworks = [];
  G.pedestalR = 0;
  if (!G.galleryRoot) return;
  G.galleryRoot.traverse((o) => {
    if (o.isMesh || o.isReflector) {
      o.geometry?.dispose?.();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of mats) {
        m.map?.dispose?.();
        m.dispose?.();
      }
    }
    if (o.isReflector) o.dispose?.();
  });
  G.galleryRoot.clear();
}
