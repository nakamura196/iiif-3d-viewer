'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { ContainerInfo } from '../../core';
import { useTranslations } from '../env';
import { OVERLAYS } from '../overlays/registry';

const MIN = 0.2;
const MAX = 20;

/** What the layers inside the stage need to know about the view. */
export interface StageInfo {
  /** Zoom on top of the fitted size (1 = the whole Canvas fits in the box). */
  scale: number;
  tx: number;
  ty: number;
  /** Size of the stage (the Canvas fitted into the box) in CSS pixels at scale 1. */
  stageW: number;
  stageH: number;
  boxW: number;
  boxH: number;
}

interface Props {
  /** A single plain image (no layers). */
  src?: string;
  alt?: string;
  /** The Canvas size. Without it, the natural size of `src`. */
  canvasWidth?: number;
  canvasHeight?: number;
  /** Width in pixels of the sharpest source image; it decides how far one can zoom in. */
  detailWidth?: number;
  /** The container whose overlays (OVERLAYS) are drawn over the image. */
  container?: ContainerInfo;
  /** The picture itself, drawn into the stage (positions are percentages of the Canvas). */
  children?: (stage: StageInfo) => ReactNode;
  /** Drawn over the picture, under the overlays. */
  extra?: ReactNode;
  onFailed?: () => void;
}

// 画像と同じ大きさの透明な層に、重ね表示（OVERLAYS）を載せる。
// 層はズーム・移動に追従する（舞台と一緒に動く）。位置は Canvas 座標の割合で置ける。
// 線の太さなどを画面上で一定にしたいときは、CSS 変数 `--image-scale`（拡大率）で割る。
export function OverlayLayer({
  container,
  canvasWidth,
  canvasHeight,
}: {
  container: ContainerInfo;
  canvasWidth: number;
  canvasHeight: number;
}) {
  const active = OVERLAYS.filter((o) => o.available(container));
  if (active.length === 0) return null;
  const sized = { ...container, width: canvasWidth, height: canvasHeight };
  return (
    <div className="absolute inset-0 pointer-events-none" data-iiif-overlay-layer>
      {active.map((o) => (
        <div key={o.id} className="absolute inset-0 pointer-events-none" data-iiif-overlay={o.id}>
          <o.Component container={sized} canvasWidth={canvasWidth} canvasHeight={canvasHeight} />
        </div>
      ))}
    </div>
  );
}

// The viewport: wheel zoom, drag to move, double-click to reset (CSS transform only).
// The picture and the overlays live in one "stage" the size of the fitted Canvas, so they move together.
// Nothing here is passed through WebGL, so images without CORS headers still show.
export default function ImageView({
  src,
  alt = '',
  canvasWidth,
  canvasHeight,
  detailWidth,
  container,
  children,
  extra,
  onFailed,
}: Props) {
  const t = useTranslations('Viewer');
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const [view, setView] = useState({ scale: 1, tx: 0, ty: 0 });
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [natural, setNatural] = useState<{ src: string; w: number; h: number } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const nat = natural && natural.src === src ? natural : null;
  const cw = canvasWidth ?? nat?.w;
  const ch = canvasHeight ?? nat?.h;

  // the stage: the Canvas fitted into the box
  let stageW = 0;
  let stageH = 0;
  if (cw && ch && size.w > 0 && size.h > 0) {
    const fit = Math.min(size.w / cw, size.h / ch);
    stageW = cw * fit;
    stageH = ch * fit;
  }
  const maxScale = detailWidth && stageW > 0 ? Math.max(MAX, (detailWidth * 3) / stageW) : MAX;
  const maxRef = useRef(maxScale);
  useEffect(() => {
    maxRef.current = maxScale;
  }, [maxScale]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      // keep the point under the cursor fixed (transform origin is the box centre)
      const px = e.clientX - rect.left - rect.width / 2;
      const py = e.clientY - rect.top - rect.height / 2;
      setView((v) => {
        const scale = Math.min(maxRef.current, Math.max(MIN, v.scale * Math.exp(-e.deltaY * 0.0015)));
        const k = scale / v.scale;
        return { scale, tx: px - (px - v.tx) * k, ty: py - (py - v.ty) * k };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  if (src !== undefined && failed === src) {
    return <div className="p-4 text-sm text-[var(--ds-fg)]" role="alert">{t('imageError')}</div>;
  }

  const stage: StageInfo = {
    scale: view.scale,
    tx: view.tx,
    ty: view.ty,
    stageW,
    stageH,
    boxW: size.w,
    boxH: size.h,
  };
  const stageStyle: CSSProperties = {
    position: 'absolute',
    left: (size.w - stageW) / 2,
    top: (size.h - stageH) / 2,
    width: stageW,
    height: stageH,
    transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`,
    transformOrigin: 'center center',
    ['--image-scale' as string]: view.scale,
  };

  return (
    <div
      ref={box}
      className="relative w-full h-full overflow-hidden touch-none select-none cursor-grab active:cursor-grabbing"
      title={t('zoomHint')}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        setView((v) => ({ ...v, tx: d.tx + e.clientX - d.x, ty: d.ty + e.clientY - d.y }));
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
      onDoubleClick={() => setView({ scale: 1, tx: 0, ty: 0 })}
    >
      {src !== undefined && !nat && !canvasWidth && (
        // only to learn the natural size (the Canvas has none)
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          className="absolute w-0 h-0 opacity-0"
          onLoad={(e) => setNatural({ src, w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
          onError={() => setFailed(src)}
        />
      )}
      {stageW > 0 && cw && ch && (
        <div style={stageStyle} data-iiif-stage>
          {src !== undefined && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={alt}
              draggable={false}
              onError={() => {
                setFailed(src);
                onFailed?.();
              }}
              className="absolute inset-0 w-full h-full"
            />
          )}
          {children?.(stage)}
          {extra}
          {container && <OverlayLayer container={container} canvasWidth={cw} canvasHeight={ch} />}
        </div>
      )}
    </div>
  );
}
