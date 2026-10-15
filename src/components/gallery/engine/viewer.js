// viewer.js — クリックした作品を OpenSeadragon で深ズーム表示するオーバーレイ。
// IIIF info.json をそのまま tileSource にし、切り抜き領域があればそこに寄せて開く。

import OpenSeadragon from "openseadragon";
import { G, $, IDLE_MS, labelHtml, escapeHtml } from "./state.js";
import { t } from "./i18n.js";

export function isOverlayOpen() {
  return $("#osd-overlay").classList.contains("show");
}

// 権利・メタデータ パネルを wallCfg.meta から組み立てる
function renderPanel(wallCfg) {
  const m = wallCfg.meta;
  const panel = $("#osd-panel");
  const info = $("#osd-info");
  let html = `<h3>${escapeHtml(wallCfg.label || "")}</h3>`;
  if (wallCfg.by) html += `<div class="by">${escapeHtml(wallCfg.by)}</div>`;
  let has = false;
  if (m) {
    if (m.required) {
      has = true;
      html += `<div class="sec"><div class="k">${escapeHtml(m.requiredLabel || t("panelRights"))}</div><div>${escapeHtml(m.required)}</div></div>`;
    }
    if (m.rights) {
      has = true;
      html += `<div class="sec"><div class="k">${t("panelRights")}</div><div><a href="${escapeHtml(m.rights)}" target="_blank" rel="noopener">${escapeHtml(m.rights)}</a></div></div>`;
    }
    if (m.metadata && m.metadata.length) {
      has = true;
      html += `<div class="sec"><div class="k">${t("panelMeta")}</div><div class="md">` +
        m.metadata.map((e) => `<div class="k">${escapeHtml(e.label)}</div><div>${escapeHtml(e.value)}</div>`).join("") +
        `</div></div>`;
    }
    if (m.source) {
      has = true;
      html += `<div class="sec"><div class="k">${t("panelSource")}</div><div><a href="${escapeHtml(m.source)}" target="_blank" rel="noopener">${escapeHtml(m.source)}</a></div></div>`;
    }
  }
  panel.innerHTML = html;
  info.style.display = has ? "" : "none"; // 情報が無ければ ⓘ を隠す
}

export function openViewer(wallCfg, resolved) {
  $("#osd-overlay").classList.add("show");
  $("#osd-title").innerHTML = labelHtml(wallCfg);
  renderPanel(wallCfg);
  $("#osd-panel").classList.remove("show"); // 既定は閉じる(ⓘで開く)
  G.pendingRegion = resolved.region || null;

  if (G.osd) {
    G.osd.open(resolved.osdTileSource);
  } else {
    G.osd = OpenSeadragon({
      id: "osd",
      prefixUrl: `${G.basePath}/gallery/osd-images/`,
      tileSources: resolved.osdTileSource,
      showNavigator: false, // 右下のミニマップは出さない
      crossOriginPolicy: "Anonymous",
      gestureSettingsMouse: { clickToZoom: false, dblClickToZoom: true },
      maxZoomPixelRatio: 2.5,
      animationTime: 0.6,
    });
    // 開くたびに、切り抜き領域があればその範囲へフィット
    G.osd.addHandler("open", () => {
      const R = G.pendingRegion;
      if (R && R.imgW) {
        G.osd.viewport.fitBounds(
          new OpenSeadragon.Rect(R.x / R.imgW, R.y / R.imgW, R.w / R.imgW, R.h / R.imgW),
          true
        );
      }
      if (window.__DEBUG) console.log("OSD open");
    });
    if (window.__DEBUG) {
      window.__osd = G.osd;
      G.osd.addHandler("open-failed", (e) => console.log("OSD open-failed:", e.message));
    }
  }
  // OSD は autoResize で自動的にコンテナ寸法に追従するため、手動 resize は呼ばない。
}

export function closeViewer(fromGesture = true) {
  $("#osd-overlay").classList.remove("show");
  $("#osd-panel").classList.remove("show"); // パネルも一緒に閉じる
  if (G.mode === "walk") {
    // 歩行モードに復帰。視点ロックには必ずユーザー操作が要る。
    // × クリック(fromGesture)なら即ロックを試み、成功すればプロンプトは出ない。
    // Esc 経由(非ジェスチャ)はロックできないので、再開を促すプロンプトを表示する。
    if (fromGesture) {
      try { G.walkControls.lock(); } catch {}
    } else {
      $("#walk-prompt").classList.add("show");
    }
    return;
  }
  G.controls.enabled = true;
  if (G.idleTimer) clearTimeout(G.idleTimer);
  G.idleTimer = setTimeout(() => {
    if (G.mode === "orbit" && !G.flight && !isOverlayOpen())
      G.controls.autoRotate = G.cfg.autoRotate !== false;
  }, IDLE_MS);
}

export function setupViewerUI() {
  $("#osd-close").addEventListener("click", () => closeViewer(true)); // クリック=ジェスチャ
  $("#osd-info").addEventListener("click", () => $("#osd-panel").classList.toggle("show"));
  window.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !isOverlayOpen()) return;
    // パネルを開いている時は、まずパネルだけ閉じる(全体は閉じない)
    if ($("#osd-panel").classList.contains("show")) {
      $("#osd-panel").classList.remove("show");
      return;
    }
    closeViewer(false); // Esc はジェスチャでないので再ロックしない
  });
}
