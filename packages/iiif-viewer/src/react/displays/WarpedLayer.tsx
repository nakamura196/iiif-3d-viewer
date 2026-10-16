'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { resolveRegion, type AlignTransform, type AlignWarp, type ImageLayer } from '../../core';

// 位置合わせの格子（局所補正）で曲げた B を、A の枠いっぱいの canvas に描く。
// CSS の行列では全体を 1 つの変換でしか動かせないので、紙や版木の少しの狂いは残る。
// ここでは B を 1 枚の画像として取り（Image API）、A の各点について「行列で移した B の、格子のずれだけ先の点」を読む。
// 画素を読むので、画像の配信元が CORS を許していること。読めない間・読めなかったときは fallback を出す。
// 拡大しても解像度は MAX_SIDE までなので、深く拡大すると粗くなる。

const MAX_SIDE = 2048;

/** B can be bent only when it is one image from an Image API service, neither rotated nor mirrored. */
export const warpableLayer = (layers: ImageLayer[]): ImageLayer | undefined => {
  const l = layers.length === 1 ? layers[0] : undefined;
  return l && l.service && l.width && l.height && !l.rotation && !l.mirror && !l.auth ? l : undefined;
};

const sourceUrlOf = (l: ImageLayer, width: number) => {
  const q = l.service!.version === 1 ? 'native' : 'default';
  return `${l.service!.id}/${l.regionSpec ?? 'full'}/${width},/0/${q}.jpg`;
};

/** For each output column (or row): the grid cell it falls in and where in it (held at the edges). */
const cellsOf = (nodes: number[], n: number, unit: number) => {
  const idx = new Int32Array(n);
  const t = new Float32Array(n);
  let i = 0;
  for (let k = 0; k < n; k++) {
    const v = (k + 0.5) * unit;
    while (i < nodes.length - 2 && v > nodes[i + 1]) i++;
    idx[k] = i;
    t[k] = Math.min(1, Math.max(0, (v - nodes[i]) / (nodes[i + 1] - nodes[i] || 1)));
  }
  return { idx, t };
};

interface Bend {
  /** A's frame and the size drawn. */
  aW: number;
  aH: number;
  outW: number;
  outH: number;
  /** B's frame, where its image goes in it, and the image read. */
  target: { x: number; y: number; w: number; h: number };
  src: ImageData;
  inv: [number, number, number, number, number, number];
  warp: AlignWarp;
  /** Paint the outside of B white (else transparent). */
  white: boolean;
}

const bend = ({ aW, aH, outW, outH, target, src, inv, warp, white }: Bend): ImageData => {
  const out = new ImageData(outW, outH);
  const o = out.data;
  if (white) o.fill(255);
  const s = src.data;
  const sw = src.width;
  const sh = src.height;
  const ux = aW / outW;
  const uy = aH / outH;
  const cx = cellsOf(warp.x, outW, ux);
  const cy = cellsOf(warp.y, outH, uy);
  const n = warp.x.length;
  const d = warp.d;
  const [a, b, c, dd, e, f] = inv;
  // B frame units to image pixels
  const kx = sw / target.w;
  const ky = sh / target.h;
  for (let v = 0; v < outH; v++) {
    const j = cy.idx[v];
    const ty = cy.t[v];
    const py = (v + 0.5) * uy;
    for (let u = 0; u < outW; u++) {
      const i = cx.idx[u];
      const tx = cx.t[u];
      const p00 = (j * n + i) * 2;
      const p10 = p00 + 2;
      const p01 = p00 + n * 2;
      const p11 = p01 + 2;
      const w00 = (1 - tx) * (1 - ty);
      const w10 = tx * (1 - ty);
      const w01 = (1 - tx) * ty;
      const w11 = tx * ty;
      const qx = (u + 0.5) * ux + w00 * d[p00] + w10 * d[p10] + w01 * d[p01] + w11 * d[p11];
      const qy = py + w00 * d[p00 + 1] + w10 * d[p10 + 1] + w01 * d[p01 + 1] + w11 * d[p11 + 1];
      // A frame -> B frame (inverse matrix) -> image pixel
      const sx = (a * qx + c * qy + e - target.x) * kx - 0.5;
      const sy = (b * qx + dd * qy + f - target.y) * ky - 0.5;
      if (sx < 0 || sy < 0 || sx > sw - 1 || sy > sh - 1) continue; // outside B: transparent
      const x0 = sx | 0;
      const y0 = sy | 0;
      const fx = sx - x0;
      const fy = sy - y0;
      const x1 = Math.min(x0 + 1, sw - 1);
      const y1 = Math.min(y0 + 1, sh - 1);
      const q00 = (y0 * sw + x0) * 4;
      const q10 = (y0 * sw + x1) * 4;
      const q01 = (y1 * sw + x0) * 4;
      const q11 = (y1 * sw + x1) * 4;
      const r = (v * outW + u) * 4;
      for (let ch = 0; ch < 3; ch++) {
        o[r + ch] =
          (1 - fy) * ((1 - fx) * s[q00 + ch] + fx * s[q10 + ch]) + fy * ((1 - fx) * s[q01 + ch] + fx * s[q11 + ch]);
      }
      o[r + 3] = 255;
    }
  }
  return out;
};

const invert = ([a, b, c, d, e, f]: AlignTransform['matrix']): Bend['inv'] | null => {
  const det = a * d - b * c;
  if (!det) return null;
  return [d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det];
};

export default function WarpedLayer({
  layer,
  bWidth,
  bHeight,
  aWidth,
  aHeight,
  transform,
  white = false,
  fallback,
}: {
  layer: ImageLayer;
  bWidth: number;
  bHeight: number;
  aWidth: number;
  aHeight: number;
  transform: AlignTransform & { warp: AlignWarp };
  /** Paint where B has nothing white instead of transparent (for the colour blend, whose tint would show there). */
  white?: boolean;
  /** Shown until the bent image is ready, and when it cannot be made. */
  fallback: ReactNode;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState<string | null>(null);
  const region = resolveRegion(layer.regionSpec, layer.width!, layer.height!);
  const srcW = Math.max(1, Math.min(region.w, MAX_SIDE));
  const url = sourceUrlOf(layer, srcW);
  const outW = Math.round(Math.min(aWidth, MAX_SIDE, (MAX_SIDE * aWidth) / aHeight));
  const outH = Math.max(1, Math.round((outW * aHeight) / aWidth));
  const key = `${url}|${outW}|${transform.matrix.join(',')}|${transform.warp.d.length}|${white}`;

  useEffect(() => {
    let cancelled = false;
    const inv = invert(transform.matrix);
    if (!inv) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (cancelled || !ref.current) return;
      try {
        const sc = document.createElement('canvas');
        sc.width = img.naturalWidth;
        sc.height = img.naturalHeight;
        const sctx = sc.getContext('2d', { willReadFrequently: true });
        if (!sctx) return;
        sctx.drawImage(img, 0, 0);
        const src = sctx.getImageData(0, 0, sc.width, sc.height);
        const target = layer.target ?? { x: 0, y: 0, w: bWidth, h: bHeight };
        const data = bend({ aW: aWidth, aH: aHeight, outW, outH, target, src, inv, warp: transform.warp, white });
        const cv = ref.current;
        cv.width = outW;
        cv.height = outH;
        cv.getContext('2d')?.putImageData(data, 0, 0);
        setReady(key);
      } catch {
        // pixels not readable (no CORS): keep the fallback
      }
    };
    img.src = url;
    return () => {
      cancelled = true;
    };
  }, [key, url, outW, outH, transform, layer.target, bWidth, bHeight, aWidth, aHeight, white]);

  const shown = ready === key;
  return (
    <>
      {!shown && fallback}
      <canvas
        ref={ref}
        className="absolute inset-0 w-full h-full"
        style={{ visibility: shown ? 'visible' : 'hidden' }}
        data-iiif-compare-warped
      />
    </>
  );
}
