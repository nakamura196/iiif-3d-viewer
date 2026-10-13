'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
  contentStateOf,
  matchTarget,
  parseContentState,
  parseDroppedText,
  startOf,
  type CanvasTarget,
  type ContainerInfo,
} from '../core';
import { manifestAtom } from './atoms';
import {
  focusAtom,
  navRequestAtom,
  nextSeq,
  usePageOrder,
  useManifestSwitch,
} from './displays/structureState';
import { useTranslations } from './env';

interface Props {
  containers: ContainerInfo[];
  selected: number;
  onSelect: (index: number) => void;
}

const isEditable = (el: EventTarget | null): boolean => {
  if (!(el instanceof HTMLElement)) return false;
  return (
    el.isContentEditable ||
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement ||
    el instanceof HTMLMediaElement
  );
};

// The page navigation of a manifest: previous / next and the arrow keys. The list of the pages
// is a tab of the right panel (panels/PagesPanel.tsx).
// It also receives the requests of the table of contents (right panel), opens the Canvas that
// the content state or `start` points to, and takes a dropped iiif-content link.
// Nothing is shown for a single container.
export default function ContainerList({ containers, selected, onSelect }: Props) {
  const t = useTranslations('Structure');
  const manifest = useAtomValue(manifestAtom);
  const [request, setRequest] = useAtom(navRequestAtom);
  const setFocus = useSetAtom(focusAtom);
  const { open, back, canGoBack } = useManifestSwitch();
  const { viewing, groups } = usePageOrder(manifest, containers);
  const sentinel = useRef<HTMLSpanElement>(null);
  // targets that wait for the manifest being opened (a content state, a drop)
  const pending = useRef<CanvasTarget[] | null>(null);
  const applied = useRef<string | null>(null);
  const opened = useRef<string | null>(null);

  const type = (manifest as { type?: string } | null)?.type;
  const isCollection = type === 'Collection';
  const rtl = viewing.direction === 'right-to-left';

  const go = useCallback(
    (index: number, target?: CanvasTarget) => {
      if (index < 0 || index >= containers.length) return;
      if (index !== selected) onSelect(index);
      setFocus(target && (target.xywh || target.t) ? { seq: nextSeq(), target } : null);
    },
    [containers.length, selected, onSelect, setFocus],
  );

  // --- page movement (in display order; a spread moves two pages at once) ---
  const groupAt = groups.findIndex((g) => g.includes(selected));
  const step = (delta: number) => {
    const g = groups[groupAt + delta];
    if (g) go(g[0]);
  };
  const hasPrev = groupAt > 0;
  const hasNext = groupAt >= 0 && groupAt < groups.length - 1;

  // --- requests from the table of contents ---
  useEffect(() => {
    if (!request) return;
    const index = containers.findIndex((c) => c.id === request.target.canvasId);
    if (index >= 0) go(index, request.target);
    setRequest(null);
  }, [request, containers, go, setRequest]);

  // --- a content state (the URL, a loaded Annotation) or `start` decides the first Canvas ---
  useEffect(() => {
    if (!manifest || containers.length === 0) return;
    const key = `${manifest.id}`;
    if (applied.current === key) return;
    applied.current = key;
    let found: (CanvasTarget & { index: number }) | null = null;
    if (pending.current) {
      found = matchTarget(pending.current, containers);
      pending.current = null;
    }
    if (!found && typeof window !== 'undefined') {
      const param = new URLSearchParams(window.location.search).get('iiif-content');
      const state = parseContentState(param);
      if (state) found = matchTarget(state.targets, containers);
    }
    if (found) {
      go(found.index, found);
      return;
    }
    const start = startOf(manifest, containers);
    if (start) go(start.index, start.t ? start : undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manifest, containers]);

  // --- an Annotation (content state) that was given instead of a manifest ---
  useEffect(() => {
    if (!manifest || type !== 'Annotation') return;
    const state = contentStateOf(manifest);
    const url = state?.manifestUrl;
    if (!state || !url || opened.current === manifest.id) return;
    opened.current = manifest.id;
    pending.current = state.targets;
    void open(url, false);
  }, [manifest, type, open]);

  // --- keyboard: arrow keys follow the viewing direction ---
  const keyRef = useRef({ step, rtl, groups, go });
  useEffect(() => {
    keyRef.current = { step, rtl, groups, go };
  });
  useEffect(() => {
    const host = sentinel.current?.parentElement?.parentElement;
    if (!host) return;
    if (!host.hasAttribute('tabindex')) host.setAttribute('tabindex', '0');
    host.classList.add('outline-none');
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isEditable(e.target)) return;
      const { step: move, rtl: isRtl, groups: gs, go: goTo } = keyRef.current;
      let handled = true;
      switch (e.key) {
        case 'ArrowRight':
          move(isRtl ? -1 : 1);
          break;
        case 'ArrowLeft':
          move(isRtl ? 1 : -1);
          break;
        case 'PageDown':
        case 'ArrowDown':
          move(1);
          break;
        case 'PageUp':
        case 'ArrowUp':
          move(-1);
          break;
        case 'Home':
          if (gs[0]) goTo(gs[0][0]);
          break;
        case 'End':
          if (gs.length) goTo(gs[gs.length - 1][0]);
          break;
        default:
          handled = false;
      }
      if (handled) e.preventDefault();
    };
    host.addEventListener('keydown', onKey);
    return () => host.removeEventListener('keydown', onKey);
  }, []);

  // --- drag and drop of an iiif-content link ---
  const onDropRef = useRef<(text: string) => void>(() => {});
  useEffect(() => {
    onDropRef.current = (text: string) => {
      const state = parseDroppedText(text);
      if (!state) return;
      if (state.manifestUrl) {
        pending.current = state.targets;
        void open(state.manifestUrl, false);
        return;
      }
      const found = matchTarget(state.targets, containers);
      if (found) go(found.index, found);
    };
  });
  useEffect(() => {
    const host = sentinel.current?.parentElement?.parentElement;
    const el = host?.parentElement ?? host;
    if (!el) return;
    const hasText = (e: DragEvent) =>
      !!e.dataTransfer && ['text/uri-list', 'text/plain'].some((ty) => e.dataTransfer?.types.includes(ty));
    const onOver = (e: DragEvent) => {
      if (hasText(e)) e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      if (!hasText(e)) return;
      e.preventDefault();
      const text = e.dataTransfer?.getData('text/uri-list') || e.dataTransfer?.getData('text/plain') || '';
      onDropRef.current(text);
    };
    el.addEventListener('dragover', onOver);
    el.addEventListener('drop', onDrop);
    return () => {
      el.removeEventListener('dragover', onOver);
      el.removeEventListener('drop', onDrop);
    };
  }, []);

  const showPager = !isCollection && containers.length >= 2;
  const showBack = canGoBack;

  if (!showPager && !showBack) {
    return (
      <div hidden>
        <span ref={sentinel} />
      </div>
    );
  }

  const group = groups[groupAt] ?? [selected];
  const progress =
    group.length > 1
      ? t('spread', { from: group[0] + 1, to: group[group.length - 1] + 1, total: containers.length })
      : t('page', { current: selected + 1, total: containers.length });

  const btn =
    'shrink-0 px-2 py-1 text-sm rounded border border-[var(--ds-border)] text-[var(--ds-fg)] hover:bg-[var(--ds-surface-2)] disabled:opacity-40 disabled:hover:bg-transparent';
  // on the screen the left button is "previous" except for right-to-left books
  const leftIsNext = rtl;

  return (
    <div className="bg-[var(--ds-surface)] border-b border-[var(--ds-border)]">
      <span ref={sentinel} hidden />
      {showBack && (
        <div className="p-1.5">
          <button type="button" className={btn} onClick={back}>
            {`‹ ${t('back')}`}
          </button>
        </div>
      )}
      {showPager && (
        <div className="flex items-center justify-center gap-2 p-1.5" role="group" aria-label={t('pager')}>
          <button
            type="button"
            className={btn}
            disabled={leftIsNext ? !hasNext : !hasPrev}
            onClick={() => step(leftIsNext ? 1 : -1)}
            aria-label={leftIsNext ? t('next') : t('prev')}
            title={leftIsNext ? t('next') : t('prev')}
          >
            ‹
          </button>
          <span className="text-sm tabular-nums text-[var(--ds-fg)]" aria-live="polite">
            {progress}
          </span>
          <button
            type="button"
            className={btn}
            disabled={leftIsNext ? !hasPrev : !hasNext}
            onClick={() => step(leftIsNext ? -1 : 1)}
            aria-label={leftIsNext ? t('prev') : t('next')}
            title={leftIsNext ? t('prev') : t('next')}
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}
