'use client';

import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { useAtomValue } from 'jotai';
import { pickedMarksAtom, pointPickerAtom, type PickMode } from '../inference/pointState';
import type { Overlay, OverlayProps } from './types';

// 推論タブで「クリックで切り出す」を始めている間だけ、画像の上の全面でクリックを拾う。
// ドラッグ（画像の移動）はそのまま通す: 押した位置から少ししか動かずに離したときだけクリックとみなす。
// Shift を押しながらなら直前の形に範囲を足す、Alt（Option）なら削る。

const SLOP = 4; // px
const DOT = '#16a34a';
const NOT = '#dc2626';

function PointPickView({ container, canvasWidth, canvasHeight }: OverlayProps) {
  const picker = useAtomValue(pointPickerAtom);
  const marks = useAtomValue(pickedMarksAtom);
  const layer = useRef<HTMLDivElement>(null);
  if (!picker || picker.canvasId !== container.id || !(canvasWidth > 0) || !(canvasHeight > 0)) return null;

  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    const x0 = e.clientX;
    const y0 = e.clientY;
    const mode: PickMode = e.shiftKey ? 'add' : e.altKey ? 'remove' : 'new';
    // 画像の箱がポインタを捕まえるので、離したときは window で受ける
    const up = (u: PointerEvent) => {
      window.removeEventListener('pointerup', up);
      const el = layer.current;
      if (!el || Math.hypot(u.clientX - x0, u.clientY - y0) > SLOP) return;
      const r = el.getBoundingClientRect(); // 拡大・移動を含んだ Canvas の位置
      const box = el.closest('[data-iiif-stage]')?.parentElement?.getBoundingClientRect() ?? r;
      const cx = (px: number) => ((px - r.left) / r.width) * canvasWidth;
      const cy = (py: number) => ((py - r.top) / r.height) * canvasHeight;
      const x = cx(x0);
      const y = cy(y0);
      if (x < 0 || y < 0 || x > canvasWidth || y > canvasHeight) return;
      picker.onPoint({ x, y, mode, view: { x0: cx(box.left), y0: cy(box.top), x1: cx(box.right), y1: cy(box.bottom) } });
    };
    window.addEventListener('pointerup', up);
  };

  const dots = marks && marks.canvasId === container.id ? marks.points : [];
  return (
    <div
      ref={layer}
      className="absolute inset-0 pointer-events-auto cursor-crosshair"
      data-overlay="point-pick"
      onPointerDown={onPointerDown}
      // 画像の箱のダブルクリック（表示を元に戻す）は、クリックを続けたときに邪魔なので止める
      onDoubleClick={(e) => e.stopPropagation()}
    >
      {dots.map((p, i) => (
        <span
          key={i}
          className="absolute w-3 h-3 rounded-full border-2 border-white shadow"
          style={{
            left: `${(p.x / canvasWidth) * 100}%`,
            top: `${(p.y / canvasHeight) * 100}%`,
            // 画面の上で同じ大きさに（幅を拡大率で割ると、1px 未満の枠が 1px に丸められて白く潰れる）
            transform: 'translate(-50%, -50%) scale(calc(1 / var(--image-scale, 1)))',
            background: p.positive ? DOT : NOT,
          }}
        />
      ))}
    </div>
  );
}

export const pointPickOverlay: Overlay = {
  id: 'point-pick',
  // order を付けない: 注釈の印より後に重ね、いちばん上でクリックを拾う
  available: () => true,
  Component: PointPickView,
};
