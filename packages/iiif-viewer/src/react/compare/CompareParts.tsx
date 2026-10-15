'use client';

import type { CSSProperties, ReactNode, RefObject } from 'react';

// 2 つを見比べる表示（3D の比較・画像の比較）が共通に使う部品。
// 表示のしかたは地図のレイヤー比較にならう: 左右に並べる・境界線を動かすスワイプ・
// ポインタの下に丸い窓で B を見せるスパイグラス。重ねる（不透明度）は画像だけ。
export type CompareMode = 'side' | 'swipe' | 'spyglass' | 'overlay';

/** Which way the swipe line runs: horizontal = B right of a vertical line (dragged sideways), vertical = B below a horizontal line (dragged up and down). */
export type SwipeDirection = 'horizontal' | 'vertical';

/** Radius of the spyglass window, in CSS pixels. */
export const LENS_RADIUS = 140;

export interface LensPoint {
  x: number;
  y: number;
}

/** The clip-path that leaves B visible: right of the swipe line, or inside the spyglass window. */
export const compareClipOf = (
  mode: CompareMode,
  split: number,
  lens: LensPoint,
  direction: SwipeDirection = 'horizontal',
): string =>
  mode === 'swipe' ? (direction === 'vertical' ? `inset(${split}% 0 0 0)` : `inset(0 0 0 ${split}%)`) : mode === 'spyglass' ? `circle(${LENS_RADIUS}px at ${lens.x}px ${lens.y}px)` : '';

/** Where the spyglass ring is drawn (its top left corner); without a point, the centre of the box. */
export const lensRingPositionOf = (lens: LensPoint | null | undefined): { left: string; top: string } =>
  lens
    ? { left: `${lens.x - LENS_RADIUS}px`, top: `${lens.y - LENS_RADIUS}px` }
    : { left: `calc(50% - ${LENS_RADIUS}px)`, top: `calc(50% - ${LENS_RADIUS}px)` };

/** A point of the box under the pointer (CSS pixels from its top left). */
export const pointInBox = (box: HTMLElement, e: { clientX: number; clientY: number }): LensPoint => {
  const r = box.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
};

/** The name of a side ("A: …"), at the top (or `bottom`) left or right of its pane. */
export const CompareChip = ({
  children,
  className = '',
  bottom = false,
}: {
  children: ReactNode;
  className?: string;
  bottom?: boolean;
}) => (
  <div
    className={`absolute ${bottom ? 'bottom-3' : 'top-3'} z-10 max-w-[45%] truncate bg-[var(--ds-surface)] px-3 py-1 rounded-full shadow text-xs font-medium text-[var(--ds-fg)] border border-[var(--ds-border)] pointer-events-none ${className}`}
  >
    {children}
  </div>
);

/**
 * The swipe line. Dragging it reports the new position (% from the left of `boxRef`; from the top when vertical).
 * `handleRef` lets a caller move it without re-rendering (the 3D panes should not re-render).
 */
export function SwipeHandle({
  boxRef,
  split,
  onSplit,
  label,
  handleRef,
  direction = 'horizontal',
}: {
  boxRef: RefObject<HTMLElement | null>;
  split: number;
  onSplit: (percent: number) => void;
  label?: string;
  handleRef?: RefObject<HTMLDivElement | null>;
  direction?: SwipeDirection;
}) {
  const vertical = direction === 'vertical';
  const drag = (e: React.PointerEvent) => {
    const box = boxRef.current;
    if (!box) return;
    e.preventDefault();
    e.stopPropagation();
    const move = (ev: PointerEvent) => {
      const r = box.getBoundingClientRect();
      const percent = vertical ? ((ev.clientY - r.top) / r.height) * 100 : ((ev.clientX - r.left) / r.width) * 100;
      onSplit(Math.min(100, Math.max(0, percent)));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return (
    <div
      ref={handleRef}
      onPointerDown={drag}
      role="separator"
      aria-orientation={vertical ? 'horizontal' : 'vertical'}
      aria-label={label}
      className={`absolute z-20 flex items-center justify-center touch-none ${
        vertical ? 'left-0 right-0 h-4 -mt-2 cursor-ns-resize' : 'top-0 bottom-0 w-4 -ml-2 cursor-ew-resize'
      }`}
      style={vertical ? { top: `${split}%` } : { left: `${split}%` }}
    >
      <div className={`bg-white shadow-[0_0_4px_rgba(0,0,0,0.6)] ${vertical ? 'h-0.5 w-full' : 'w-0.5 h-full'}`} />
      <div className="absolute w-7 h-7 rounded-full bg-white shadow flex items-center justify-center text-gray-700 text-xs select-none">
        {vertical ? '⇕' : '⇔'}
      </div>
    </div>
  );
}

/** The ring around the spyglass window (at the centre until the pointer comes). `ringRef`: move it without re-rendering. */
export function LensRing({ lens, ringRef }: { lens?: LensPoint | null; ringRef?: RefObject<HTMLDivElement | null> }) {
  const style: CSSProperties = { width: LENS_RADIUS * 2, height: LENS_RADIUS * 2, ...lensRingPositionOf(lens) };
  return (
    <div
      ref={ringRef}
      className="absolute z-10 rounded-full border-2 border-white shadow-[0_0_6px_rgba(0,0,0,0.6)] pointer-events-none"
      style={style}
    />
  );
}

/** A short hint at the bottom right (e.g. what the spyglass shows). */
export const CompareHint = ({ children }: { children: ReactNode }) => (
  <div className="absolute bottom-3 right-3 z-10 text-xs bg-[var(--ds-surface)]/90 px-2 py-1 rounded shadow text-[var(--ds-fg)] pointer-events-none">
    {children}
  </div>
);
