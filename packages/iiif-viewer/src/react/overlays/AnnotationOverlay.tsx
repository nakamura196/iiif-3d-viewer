'use client';

import { useAtom, useAtomValue } from 'jotai';
import {
  bboxOf,
  pickBodies,
  pointPercent,
  regionBoxPercent,
  sanitizeHtml,
  type CanvasAnnotation,
} from '../../core';
import { manifestAtom } from '../atoms';
import { useLocale } from '../env';
import { selectedCanvasAnnotationAtom } from './canvasAnnotationState';
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
  const { annotations } = useCanvasAnnotations(manifest, container);
  const [selected, setSelected] = useAtom(selectedCanvasAnnotationAtom);

  const drawn = annotations
    .filter((a) => a.region.type !== 'canvas')
    .sort((a, b) => areaOf(b) - areaOf(a));
  if (drawn.length === 0 || !(canvasWidth > 0) || !(canvasHeight > 0)) return null;

  const titleOf = (a: CanvasAnnotation) =>
    pickBodies(a.bodies, locale)
      .filter((b) => b.kind === 'text')
      .map((b) => (/html/i.test(b.format ?? '') ? plain(b.value ?? '') : b.value))
      .join(' / ');

  return (
    <div className="absolute inset-0 pointer-events-none" data-overlay="annotations">
      {drawn.map((a) => {
        const r = a.region;
        const isSel = selected === a.id;
        const toggle = (e: { stopPropagation: () => void }) => {
          e.stopPropagation();
          setSelected(isSel ? null : a.id);
        };
        const common = {
          title: titleOf(a) || undefined,
          'data-annotation-id': a.id,
        };
        if (r.type === 'point') {
          const p = pointPercent(r.x, r.y, canvasWidth, canvasHeight);
          return (
            <button
              key={a.id}
              type="button"
              {...common}
              onClick={toggle}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label={titleOf(a) || undefined}
              className={`absolute pointer-events-auto rounded-full border-2 border-white shadow ${
                isSel ? 'bg-orange-500 w-5 h-5' : 'bg-blue-600 w-4 h-4'
              }`}
              style={{ left: `${p.left}%`, top: `${p.top}%`, transform: 'translate(-50%, -50%)' }}
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
              key={a.id}
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
                  fill={isSel ? 'rgba(249,115,22,0.30)' : 'rgba(37,99,235,0.15)'}
                  stroke={isSel ? '#f97316' : STROKE}
                  strokeWidth={2}
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
              key={a.id}
              {...common}
              role="button"
              tabIndex={0}
              onClick={toggle}
              onPointerDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') toggle(e);
              }}
              className={`absolute pointer-events-auto cursor-pointer overflow-hidden border-2 ${
                isSel ? 'border-orange-500 bg-orange-500/25' : 'border-blue-600 bg-blue-600/10'
              }`}
              style={{
                left: `${b.left}%`,
                top: `${b.top}%`,
                width: `${b.width}%`,
                height: `${b.height}%`,
                ...(html ? { containerType: 'size' as const } : {}),
              }}
            >
              {html ? (
                <div
                  className="text-white bg-black/50 w-full h-full break-words"
                  style={{ fontSize: '12cqh', lineHeight: 1.2 }}
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
                />
              ) : null}
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}

export const annotationOverlay: Overlay = {
  id: 'annotations',
  available: (container) => container.kind === 'Canvas',
  Component: AnnotationOverlayView,
};
