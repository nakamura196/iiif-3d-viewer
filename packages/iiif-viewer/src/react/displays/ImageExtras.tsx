'use client';

import { useState } from 'react';
import type { ImageAnnotation } from '../../core';
import { useTranslations } from '../env';

const pct = (v: number) => `${v * 100}%`;

// 画像を持つ注釈（レシピ 0377）と、画像レイヤー専用の注釈（0326）を、画像の上に枠で出す。
// 枠にポインタを載せる（またはフォーカスする）と、画像と文を出す。
// 枠の線と吹き出しは、拡大しても画面上の大きさが変わらないよう `--image-scale` で割る。
export function AnnotationBoxes({
  annotations,
  canvasWidth,
  canvasHeight,
}: {
  annotations: ImageAnnotation[];
  canvasWidth: number;
  canvasHeight: number;
}) {
  const t = useTranslations('Viewer');
  if (annotations.length === 0) return null;
  return (
    <div className="absolute inset-0 pointer-events-none" data-iiif-image-annotations>
      {annotations.map((a) => (
        <div
          key={a.id}
          tabIndex={0}
          className="group absolute pointer-events-auto outline-none"
          style={{
            left: pct(a.region.x / canvasWidth),
            top: pct(a.region.y / canvasHeight),
            width: pct(a.region.w / canvasWidth),
            height: pct(a.region.h / canvasHeight),
            border: 'calc(2px / var(--image-scale, 1)) solid rgba(37, 99, 235, 0.9)',
            background: 'rgba(37, 99, 235, 0.08)',
          }}
        >
          <div
            className="hidden group-hover:block group-focus:block absolute left-0 top-full z-10 w-max max-w-[18rem] rounded border border-[var(--ds-border)] bg-[var(--ds-surface)] p-2 text-sm text-[var(--ds-fg)] shadow-lg"
            style={{ scale: 'calc(1 / var(--image-scale, 1))', transformOrigin: 'top left' }}
          >
            {a.images.map((src) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={src} src={src} alt={t('annotationImage')} className="mb-1 max-w-[12rem]" draggable={false} />
            ))}
            {a.text && <p className="whitespace-pre-wrap">{a.text}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

// 動画の表紙（placeholderCanvas、なければサムネイル）。押すと隠れて、再生を始める。
// 再生位置が動き始めたとき（文字起こしからの移動など）も隠れる。
export function MediaCover({
  src,
  dismissed,
  onDismiss,
  onPlay,
}: {
  src: string;
  dismissed: boolean;
  onDismiss: () => void;
  onPlay: () => void;
}) {
  const t = useTranslations('Viewer');
  if (dismissed) return null;
  return (
    <button
      type="button"
      onClick={() => {
        onDismiss();
        onPlay();
      }}
      aria-label={t('playMedia')}
      className="absolute inset-0 z-10 flex items-center justify-center bg-black cursor-pointer"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" draggable={false} className="max-w-full max-h-full object-contain" />
      <span className="absolute w-16 h-16 rounded-full bg-black/60 text-white text-3xl grid place-items-center">
        <span aria-hidden="true">▶</span>
      </span>
    </button>
  );
}

export interface ThumbnailItem {
  key: string;
  label: string;
  url?: string;
}

// サムネイルの並び。Canvas が thumbnail を持っているときだけ出す（持たないときは出さない）。
export function ThumbnailStrip({
  items,
  selected,
  onSelect,
}: {
  items: ThumbnailItem[];
  selected: number;
  onSelect: (index: number) => void;
}) {
  const t = useTranslations('Viewer');
  const [broken, setBroken] = useState<Record<string, boolean>>({});
  return (
    <div
      role="group"
      aria-label={t('thumbnails')}
      className="shrink-0 flex gap-1.5 overflow-x-auto p-1.5 bg-[var(--ds-surface)] border-t border-[var(--ds-border)]"
    >
      {items.map((it, i) => (
        <button
          key={it.key}
          type="button"
          onClick={() => onSelect(i)}
          aria-current={i === selected ? 'true' : undefined}
          title={it.label}
          className={`shrink-0 h-14 min-w-10 rounded border overflow-hidden text-xs text-[var(--ds-fg)] ${
            i === selected ? 'border-blue-600 ring-2 ring-blue-600' : 'border-[var(--ds-border)]'
          }`}
        >
          {it.url && !broken[it.key] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={it.url}
              alt={it.label}
              draggable={false}
              className="h-full w-auto"
              onError={() => setBroken((b) => ({ ...b, [it.key]: true }))}
            />
          ) : (
            <span className="px-1">{it.label || i + 1}</span>
          )}
        </button>
      ))}
    </div>
  );
}
