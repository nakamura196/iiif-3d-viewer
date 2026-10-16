'use client';

// 長い一覧（注釈 2 万件など）を、見えている行とその前後だけ描く。
// 行の高さはまちまちなので、描いた行は実際の高さを測って覚え、まだ描いていない行は見込みの高さで数える。
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';

/** Where each row starts: offsets[i] is the top of row i, offsets[n] the total height. */
export const rowOffsets = (keys: readonly string[], heights: ReadonlyMap<string, number>, estimate: number): Float64Array => {
  const out = new Float64Array(keys.length + 1);
  for (let i = 0; i < keys.length; i++) out[i + 1] = out[i] + (heights.get(keys[i]) ?? estimate);
  return out;
};

/** The row at a given height (the last row whose top is at or above it). */
export const rowAt = (offsets: Float64Array, y: number): number => {
  const n = offsets.length - 1;
  if (n <= 0) return 0;
  let lo = 0;
  let hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (offsets[mid] <= y) lo = mid;
    else hi = mid - 1;
  }
  return lo;
};

/** The rows to draw: those in [top, top + height], and `overscan` more on each side. */
export const visibleRange = (
  offsets: Float64Array,
  top: number,
  height: number,
  overscan: number,
): { start: number; end: number } => {
  const n = offsets.length - 1;
  if (n <= 0) return { start: 0, end: 0 };
  const first = rowAt(offsets, top);
  const last = rowAt(offsets, top + Math.max(height, 1));
  return { start: Math.max(0, first - overscan), end: Math.min(n, last + 1 + overscan) };
};

/**
 * The scroll position that brings a row into view, or null when it is already in view
 * (like `scrollIntoView({ block: 'nearest' })`).
 */
export const scrollToShow = (offsets: Float64Array, index: number, top: number, height: number): number | null => {
  const a = offsets[index];
  const b = offsets[index + 1];
  if (a === undefined || b === undefined) return null;
  if (a >= top && b <= top + height) return null;
  if (b - a >= height || a < top) return a;
  return b - height;
};

// DOM の書き換えは描画の外（イベント・effect）でだけ行う
const scrollBy = (el: HTMLElement, dy: number) => {
  el.scrollTop += dy;
};
const scrollTo = (el: HTMLElement, y: number) => {
  el.scrollTop = y;
};

export interface VirtualRows {
  /** Rows to draw, [start, end). */
  start: number;
  end: number;
  /** Top of each row in the list (offsets[i]); the last value is the total height. */
  offsets: Float64Array;
  /** Give to each drawn row (with its key as `data-key` and its top as `data-top`), so that its height is measured. */
  measure: (el: HTMLElement | null) => void;
}

export function useVirtualRows(
  scroller: RefObject<HTMLElement | null>,
  keys: readonly string[],
  { estimate = 72, overscan = 8, listTop = 0 }: { estimate?: number; overscan?: number; listTop?: number } = {},
): VirtualRows {
  const [heights, setHeights] = useState<ReadonlyMap<string, number>>(() => new Map());
  const [view, setView] = useState({ top: 0, height: 0 });

  const offsets = useMemo(() => rowOffsets(keys, heights, estimate), [keys, heights, estimate]);

  // follow the scroll position and the size of the scrolling box
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const update = () =>
      setView((v) => {
        const top = Math.max(0, el.scrollTop - listTop);
        return v.top === top && v.height === el.clientHeight ? v : { top, height: el.clientHeight };
      });
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, [scroller, listTop]);

  // measure the drawn rows; the heights measured in one frame are kept in one update.
  // The observer is made on the first row given (refs are set before effects run).
  const config = useRef({ scroller, estimate, listTop });
  useLayoutEffect(() => {
    config.current = { scroller, estimate, listTop };
  }, [scroller, estimate, listTop]);
  const observer = useRef<ResizeObserver | null>(null);
  const known = useRef(new Map<string, number>());
  const pending = useRef(new Map<string, number>());
  const frame = useRef(0);
  const onResize = useCallback((entries: ResizeObserverEntry[]) => {
    const { scroller, estimate, listTop } = config.current;
    let above = 0; // change of height above the top of the view: keep what is seen in place
    const el = scroller.current;
    const top = el ? el.scrollTop - listTop : 0;
    for (const e of entries) {
      const target = e.target as HTMLElement;
      const key = target.dataset.key;
      if (!key || !target.isConnected) continue;
      const h = target.offsetHeight;
      const old = known.current.get(key);
      if (old === h) continue;
      if (Number(target.dataset.top) < top) above += h - (old ?? estimate);
      known.current.set(key, h);
      pending.current.set(key, h);
    }
    if (el && above !== 0) scrollBy(el, above);
    if (pending.current.size > 0 && !frame.current) {
      frame.current = requestAnimationFrame(() => {
        frame.current = 0;
        const add = pending.current;
        pending.current = new Map();
        setHeights((prev) => new Map([...prev, ...add]));
      });
    }
  }, []);
  useEffect(
    () => () => {
      observer.current?.disconnect();
      observer.current = null;
      cancelAnimationFrame(frame.current);
      frame.current = 0;
    },
    [],
  );

  const measure = useCallback(
    (el: HTMLElement | null) => {
      if (!el) return;
      const ro = (observer.current ??= new ResizeObserver(onResize));
      ro.observe(el);
      return () => ro.unobserve(el);
    },
    [onResize],
  );

  const { start, end } = visibleRange(offsets, view.top, view.height, overscan);
  return { start, end, offsets, measure };
}

/** Scroll the list so that row `index` shows (nothing if it already does). */
export const scrollRowIntoView = (el: HTMLElement | null, offsets: Float64Array, index: number, listTop = 0) => {
  if (!el) return;
  const to = scrollToShow(offsets, index, el.scrollTop - listTop, el.clientHeight);
  if (to !== null) scrollTo(el, to + listTop);
};
