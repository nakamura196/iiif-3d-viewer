// index.js — 目次(作品一覧)。展示中の作品をサムネのグリッドで一覧し、
// クリックでその作品へ寄って(見回し)/その場で(歩行)拡大表示する。
// データは G.artworks(展示順の作品メッシュ)を使うので追加のフェッチは不要。

import { G, $ } from "./state.js";
import { t } from "./i18n.js";
import { focusAndZoom } from "./controls.js";

export function setupIndexUI() {
  const btn = $("#index-toggle");
  const overlay = $("#index-overlay");
  if (!btn || !overlay) return;

  btn.addEventListener("click", openIndex);
  $("#index-close").addEventListener("click", closeIndex);
  // 背景(グリッド以外)クリックで閉じる
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeIndex(); });
  // Esc で閉じる(開いている時だけ横取り)
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay.classList.contains("show")) {
      e.stopPropagation();
      closeIndex();
    }
  }, true);

  // 目次ボタンは展示入室中だけ表示(入口では隠す) — quality-toggle と同じ仕組み
  const sync = () => {
    const inGallery = !$("#entrance").classList.contains("show");
    btn.classList.toggle("show", inGallery && G.artworks.length > 0);
  };
  new MutationObserver(sync).observe($("#entrance"), { attributes: true, attributeFilter: ["class"] });
  sync();
}

function openIndex() {
  if (!G.artworks.length) return;
  // 歩行中はポインタロックを解除しないとオーバーレイを操作できない
  if (G.mode === "walk" && G.walkControls?.isLocked) G.walkControls.unlock();
  if (G.mode === "orbit") G.controls.autoRotate = false;
  $("#index-overlay").classList.add("show");
}

export function closeIndex() {
  $("#index-overlay").classList.remove("show");
}

// G.artworks から一覧グリッドを組み立て直す。buildGallery の最後に呼ばれる。
export function buildIndex() {
  const grid = $("#index-grid");
  const btn = $("#index-toggle");
  if (!grid) return;
  grid.innerHTML = "";

  if (!G.artworks.length) {
    const empty = document.createElement("div");
    empty.id = "index-empty";
    empty.textContent = t("indexEmpty");
    grid.appendChild(empty);
    btn?.classList.remove("show");
    return;
  }

  const frag = document.createDocumentFragment();
  G.artworks.forEach((art, i) => {
    const { wallCfg, resolved } = art.userData;
    const card = document.createElement("button");
    card.type = "button";
    card.className = "ix-card";
    card.title = wallCfg.label || "";

    const num = document.createElement("span");
    num.className = "ix-num";
    num.textContent = String(i + 1);

    const img = document.createElement("img");
    img.className = "ix-thumb";
    img.loading = "lazy";
    img.alt = wallCfg.label || "";
    // 一覧サムネは軽く。通常の <img> なので CORS 不要で表示できる。
    img.src = resolved.thumb(240);
    img.addEventListener("error", () => { img.style.visibility = "hidden"; });

    const meta = document.createElement("div");
    meta.className = "ix-meta";
    const label = document.createElement("div");
    label.className = "ix-label";
    label.textContent = wallCfg.label || `#${i + 1}`;
    meta.appendChild(label);
    if (wallCfg.by) {
      const by = document.createElement("div");
      by.className = "ix-by";
      by.textContent = wallCfg.by;
      meta.appendChild(by);
    }

    card.append(num, img, meta);
    card.addEventListener("click", () => {
      closeIndex();
      focusAndZoom(art);
    });
    frag.appendChild(card);
  });
  grid.appendChild(frag);

  // 入室中なら目次ボタンを表示
  if (!$("#entrance").classList.contains("show")) btn?.classList.add("show");
}
