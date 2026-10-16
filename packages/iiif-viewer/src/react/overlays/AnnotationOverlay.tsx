'use client';

import { useAtom, useAtomValue } from 'jotai';
import { memo, useCallback, useDeferredValue, useMemo } from 'react';
import {
  annotationSearchText,
  bboxOf,
  groupByRegion,
  matchesSearchTerms,
  pickBodies,
  pointPercent,
  regionBoxPercent,
  sanitizeAnnotationHtml,
  searchTerms,
  type CanvasAnnotation,
  type RegionGroup,
  type StyleDeclarations,
} from '../../core';
import { manifestAtom } from '../atoms';
import { useLocale } from '../env';
import { canvasAnnotationGranularityAtom, canvasAnnotationQueryAtom, selectedCanvasAnnotationAtom } from './canvasAnnotationState';
import { storyFrameAtom, storyOpenAtom } from './storyState';
import type { Overlay, OverlayProps } from './types';
import { useCanvasAnnotations } from './useCanvasAnnotations';

const plain = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

// 領域の面積（小さい物を手前に置くための並べ替え用）
const areaOf = (a: CanvasAnnotation): number => {
  const r = a.region;
  if (r.type === 'rect') return r.w * r.h;
  if (r.type === 'polygon') return r.bbox.w * r.bbox.h;
  return 0;
};

const STROKE = '#2563eb';

// 画像の上に、Canvas 上の注釈の領域を重ねる。位置は Canvas 座標の割合で置く（画像と同じ大きさの層の中）。
// Canvas 全体への注釈は枠を描かない（右パネルにだけ出る）。
export function AnnotationOverlayView({ container, canvasWidth, canvasHeight }: OverlayProps) {
  const locale = useLocale();
  const manifest = useAtomValue(manifestAtom);
  const { annotations, styleOf } = useCanvasAnnotations(manifest, container);
  const [selected, setSelected] = useAtom(selectedCanvasAnnotationAtom);
  // While a story is read, only the current scene may be framed (thin line, no fill), and only when asked.
  const storyOpen = useAtomValue(storyOpenAtom);
  const storyFrame = useAtomValue(storyFrameAtom);
  const granularity = useAtomValue(canvasAnnotationGranularityAtom);
  // 右パネルの検索欄に文字があれば、当たった注釈の印だけを出す（選んでいる注釈は残す）
  const query = useDeferredValue(useAtomValue(canvasAnnotationQueryAtom));
  const terms = useMemo(() => searchTerms(query), [query]);

  // Annotations that share a region (Shared Region extension) are drawn as one box, in the order of the list.
  // A story shows only its current scene, so the chosen annotation matters to the list only then.
  const storySelected = storyOpen ? (storyFrame && selected ? selected : '\u0000') : null;
  const drawn = useMemo(() => {
    const shown = annotations
      .filter((a) => a.region.type !== 'canvas' && !a.layer) // layer annotations are drawn by the layer itself
      .filter((a) => storySelected === null || a.id === storySelected)
      .filter((a) => !granularity || a.granularity === granularity || a.motivations.includes('highlighting'))
      .filter((a) => terms.length === 0 || matchesSearchTerms(annotationSearchText(a), terms));
    return groupByRegion(shown).sort((a, b) => areaOf(b.annotations[0]) - areaOf(a.annotations[0]));
  }, [annotations, storySelected, granularity, terms]);
  // the chosen one stays drawn when a search would hide it
  const chosen = useMemo(() => {
    if (!selected || terms.length === 0 || drawn.some((g) => g.annotations.some((m) => m.id === selected))) return [];
    const a = annotations.find((x) => x.id === selected && x.region.type !== 'canvas' && !x.layer);
    return a ? groupByRegion([a]) : [];
  }, [selected, terms, drawn, annotations]);
  const toggle = useCallback((id: string, isSel: boolean) => setSelected(isSel ? null : id), [setSelected]);
  if (drawn.length + chosen.length === 0 || !(canvasWidth > 0) || !(canvasHeight > 0)) return null;

  // Each mark is drawn again only when it changes (being chosen or not), not when another one is chosen:
  // a Canvas may have tens of thousands of them.
  return (
    <div className="absolute inset-0 pointer-events-none" data-overlay="annotations">
      {[...drawn, ...chosen].map((g) => (
        <Mark
          key={g.key}
          group={g}
          selected={selected !== null && g.annotations.some((m) => m.id === selected)}
          storyOpen={storyOpen}
          canvasWidth={canvasWidth}
          canvasHeight={canvasHeight}
          locale={locale}
          styleOf={styleOf}
          onToggle={toggle}
        />
      ))}
    </div>
  );
}

const titleOf = (a: CanvasAnnotation, locale: string) =>
  pickBodies(a.bodies, locale)
    .filter((b) => b.kind === 'text')
    .map((b) => (/html/i.test(b.format ?? '') ? plain(b.value ?? '') : b.value))
    .join(' / ');

const Mark = memo(function Mark({
  group: g,
  selected: isSel,
  storyOpen,
  canvasWidth,
  canvasHeight,
  locale,
  styleOf,
  onToggle,
}: {
  group: RegionGroup<CanvasAnnotation>;
  selected: boolean;
  storyOpen: boolean;
  canvasWidth: number;
  canvasHeight: number;
  locale: string;
  styleOf: (a: CanvasAnnotation) => { target: StyleDeclarations };
  onToggle: (id: string, isSel: boolean) => void;
}) {
  const a = g.annotations[0];
  const count = g.annotations.length;
  const r = a.region;
  const toggle = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    onToggle(a.id, isSel);
  };
  // 見た目の指定（許可した性質だけ）。選択中は既定の強調を優先する。
  const st: StyleDeclarations = isSel ? {} : styleOf(a).target;
  const common = {
    title: g.annotations.map((m) => titleOf(m, locale)).filter(Boolean).join(' / ') || undefined,
    ...(count > 1 ? { 'data-annotation-count': count } : {}),
    'data-annotation-id': a.id,
  };
  if (r.type === 'point') {
    const p = pointPercent(r.x, r.y, canvasWidth, canvasHeight);
    return (
      <button
        key={g.key}
        type="button"
        {...common}
        onClick={toggle}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label={common.title}
        className={`absolute pointer-events-auto rounded-full border-2 border-white shadow ${
          isSel ? 'bg-orange-500 w-5 h-5' : 'bg-blue-600 w-4 h-4'
        }`}
        style={{
          ...st,
          left: `${p.left}%`,
          top: `${p.top}%`,
          // keep the mark the same size on screen at any zoom
          transform: 'translate(-50%, -50%) scale(calc(1 / var(--image-scale, 1)))',
        }}
      />
    );
  }
  if (r.type === 'polygon') {
    const b = regionBoxPercent(r, canvasWidth, canvasHeight)!;
    // draw in the Canvas's own coordinates inside a box that covers only the bounding box
    const box = bboxOf(r.rings);
    const pad = 0;
    return (
      <svg
        key={g.key}
        className="absolute pointer-events-none overflow-visible"
        style={{ left: `${b.left}%`, top: `${b.top}%`, width: `${b.width}%`, height: `${b.height}%` }}
        viewBox={`${box.x - pad} ${box.y - pad} ${box.w || 1} ${box.h || 1}`}
        preserveAspectRatio="none"
      >
        {r.rings.map((ring, i) => (
          <polygon
            key={i}
            {...common}
            points={ring.map((pt) => pt.join(',')).join(' ')}
            className="pointer-events-auto cursor-pointer"
            fill={isSel ? (storyOpen ? 'none' : 'rgba(249,115,22,0.30)') : (st.backgroundColor ?? 'rgba(37,99,235,0.15)')}
            stroke={isSel ? '#f97316' : (st.borderColor ?? STROKE)}
            // non-scaling-stroke keeps the width from the viewBox's stretch, but not from the stage's CSS
            // zoom (the same as the rectangles' outline below), so the width is divided by the zoom too.
            style={{ strokeWidth: 'calc(2px / var(--image-scale, 1))' }}
            vectorEffect="non-scaling-stroke"
            onClick={toggle}
            onPointerDown={(e) => e.stopPropagation()}
          />
        ))}
      </svg>
    );
  }
  if (r.type === 'rect') {
    const b = regionBoxPercent(r, canvasWidth, canvasHeight)!;
    const html = a.painted
      ? pickBodies(a.bodies, locale).find((x) => x.kind === 'text')?.value
      : undefined;
    return (
      <div
        key={g.key}
        {...common}
        role="button"
        tabIndex={0}
        onClick={toggle}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') toggle(e);
        }}
        className={`absolute pointer-events-auto cursor-pointer overflow-hidden ${
          isSel ? (storyOpen ? '' : 'bg-orange-500/10') : 'bg-blue-600/10'
        }`}
        style={{
          ...st,
          // The outline is an inset shadow divided by the zoom, so it stays 2px on screen.
          // A CSS border never gets thinner than one pixel before the stage is magnified (at 100x it
          // is 100px wide), and an svg non-scaling-stroke does not see the CSS transform either.
          // A border the manifest's stylesheet asks for (recipe 0045) is kept as it is.
          ...(!isSel && (st.border || st.borderStyle || st.borderWidth)
            ? {}
            : {
                borderStyle: 'none',
                boxShadow: `inset 0 0 0 calc(2px / var(--image-scale, 1)) ${isSel ? '#f97316' : (st.borderColor ?? STROKE)}`,
              }),
          left: `${b.left}%`,
          top: `${b.top}%`,
          width: `${b.width}%`,
          height: `${b.height}%`,
          ...(html ? { containerType: 'size' as const } : {}),
        }}
      >
        {count > 1 ? (
          <span
            className="absolute left-0 top-0 rounded-br bg-blue-600 px-1 text-white leading-tight"
            style={{ fontSize: '12px', transformOrigin: 'top left', scale: 'calc(1 / var(--image-scale, 1))' }}
          >
            {count}
          </span>
        ) : null}
        {html ? (
          <div
            className="text-white bg-black/50 w-full h-full break-words"
            style={{ fontSize: '12cqh', lineHeight: 1.2 }}
            dangerouslySetInnerHTML={{ __html: sanitizeAnnotationHtml(html) }}
          />
        ) : null}
      </div>
    );
  }
  return null;
});

export const annotationOverlay: Overlay = {
  id: 'annotations',
  available: (container) => container.kind === 'Canvas',
  Component: AnnotationOverlayView,
};
