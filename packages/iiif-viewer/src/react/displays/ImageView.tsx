'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from '../env';

const MIN = 0.2;
const MAX = 20;

// A plain <img> with wheel zoom and drag to move (CSS transform only).
// It is not passed through WebGL, so images without CORS headers still show.
export default function ImageView({ src, alt = '' }: { src: string; alt?: string }) {
  const t = useTranslations('Viewer');
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const [view, setView] = useState({ scale: 1, tx: 0, ty: 0 });
  const [failed, setFailed] = useState<string | null>(null);

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
        const scale = Math.min(MAX, Math.max(MIN, v.scale * Math.exp(-e.deltaY * 0.0015)));
        const k = scale / v.scale;
        return { scale, tx: px - (px - v.tx) * k, ty: py - (py - v.ty) * k };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  if (failed === src) {
    return <div className="p-4 text-sm text-[var(--ds-fg)]" role="alert">{t('imageError')}</div>;
  }

  return (
    <div
      ref={box}
      className="w-full h-full overflow-hidden flex items-center justify-center touch-none select-none cursor-grab active:cursor-grabbing"
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
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        draggable={false}
        onError={() => setFailed(src)}
        className="max-w-full max-h-full object-contain"
        style={{
          transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`,
          transformOrigin: 'center center',
        }}
      />
    </div>
  );
}
