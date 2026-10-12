'use client';

import { useMemo, useRef, useState } from 'react';
import {
  canvasImagesOf,
  chosenLayersOf,
  detailWidthOf,
  paintsImage,
  rawCanvasOf,
  type CanvasImages,
  type CanvasPainting,
} from '../../core';
import {
  CompareChip,
  CompareHint,
  LensRing,
  SwipeHandle,
  compareClipOf,
  pointInBox,
  type CompareMode,
  type LensPoint,
} from '../compare/CompareParts';
import { ImageLayers } from './ImageTiles';
import ImageView, { INITIAL_VIEW, stageStyleOf, zoomStageAt, type StageInfo, type ViewState } from './ImageView';
import { useRawManifest } from './rawManifest';

// 1 つの Canvas の Choice（例: 元画像と透過光画像）から 2 つを選び、見比べる。
// 左右に並べる: 2 つの ImageView が同じ view（拡大・移動）を共有する。
// スワイプ・スパイグラス・重ねる: 1 つの ImageView に A を描き、その上に同じ大きさの舞台で B を描いて、
// B を clip-path（線の右側・丸い窓）か不透明度で切る。スパイグラスは窓の中だけ B を拡大できる（虫眼鏡）。
// 線・窓・ラベルの部品は 3D の比較と共通（compare/CompareParts）。

/** The images of one Canvas, read from the manifest as served (undefined while loading). */
export function useCanvasImages(iiifContent: string | null, canvasId: string | undefined): CanvasImages | undefined {
  const raw = useRawManifest(iiifContent);
  return useMemo(() => {
    const canvas = raw && canvasId ? rawCanvasOf(raw, canvasId) : undefined;
    return canvas ? canvasImagesOf(canvas) : undefined;
  }, [raw, canvasId]);
}

export interface ImageCompareViewProps {
  images: CanvasImages;
  /** The painting whose candidates are compared (see `imageChoiceOf`). */
  choice: CanvasPainting;
  /** Indexes of the two candidates (A, B). */
  pick: [number, number];
  mode: CompareMode;
  labels: [string, string];
  /** Spyglass magnification of B (1 = the same scale as A). */
  zoom?: number;
  /** Overlay: opacity of B (0 to 1). */
  opacity?: number;
  /** Accessible name of the swipe line, and the hint shown in spyglass mode. */
  swipeHandleLabel?: string;
  spyglassHint?: string;
}

export default function ImageCompareView({
  images,
  choice,
  pick,
  mode,
  labels,
  zoom = 1,
  opacity = 0.5,
  swipeHandleLabel,
  spyglassHint,
}: ImageCompareViewProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<ViewState>(INITIAL_VIEW);
  const [split, setSplit] = useState(50); // swipe line, % from the left
  const [lens, setLens] = useState<LensPoint | null>(null);

  const { width, height } = images;
  // one side: the chosen candidate of the compared painting, the first of the others
  const paintings = images.paintings.filter(paintsImage);
  const layers = ([0, 1] as const).map((side) => chosenLayersOf(paintings, (p) => (p.id === choice.id ? pick[side] : 0)));
  const detail = detailWidthOf(layers.flat());

  if (!width || !height) return null;

  const draw = (side: 0 | 1, stage: StageInfo) => (
    <ImageLayers layers={layers[side]} canvasWidth={width} canvasHeight={height} stage={stage} />
  );

  if (mode === 'side') {
    return (
      <div className="relative w-full h-full flex flex-col sm:flex-row gap-px bg-[var(--ds-border)]">
        {([0, 1] as const).map((side) => (
          <div key={side} className="relative flex-1 min-w-0 min-h-0 bg-gray-100 dark:bg-gray-900">
            <ImageView canvasWidth={width} canvasHeight={height} detailWidth={detail} view={view} onViewChange={setView}>
              {(stage) => draw(side, stage)}
            </ImageView>
            <CompareChip className="left-3">
              {side === 0 ? 'A' : 'B'}: {labels[side]}
            </CompareChip>
          </div>
        ))}
      </div>
    );
  }

  // B over A, cut or faded in box coordinates
  const over = (stage: StageInfo) => {
    const at = lens ?? { x: stage.boxW / 2, y: stage.boxH / 2 };
    const s = mode === 'spyglass' && zoom !== 1 ? zoomStageAt(stage, zoom, at.x, at.y) : stage;
    return (
      // swipe and spyglass hide A inside the cut, also where B paints nothing; overlay only fades B in
      <div
        className={`absolute inset-0 pointer-events-none ${mode === 'overlay' ? '' : 'bg-gray-100 dark:bg-gray-900'}`}
        style={mode === 'overlay' ? { opacity } : { clipPath: compareClipOf(mode, split, at) }}
        data-iiif-compare-b
      >
        <div style={stageStyleOf(s)}>{draw(1, s)}</div>
      </div>
    );
  };

  return (
    <div
      ref={boxRef}
      className="relative w-full h-full overflow-hidden bg-gray-100 dark:bg-gray-900"
      onPointerMove={(e) => {
        if (mode === 'spyglass' && boxRef.current) setLens(pointInBox(boxRef.current, e));
      }}
    >
      <ImageView canvasWidth={width} canvasHeight={height} detailWidth={detail} view={view} onViewChange={setView} over={over}>
        {(stage) => draw(0, stage)}
      </ImageView>
      <CompareChip className="left-3">A: {labels[0]}</CompareChip>
      <CompareChip className="right-3">B: {labels[1]}</CompareChip>
      {mode === 'spyglass' && <LensRing lens={lens} />}
      {mode === 'swipe' && <SwipeHandle boxRef={boxRef} split={split} onSplit={setSplit} label={swipeHandleLabel} />}
      {mode === 'spyglass' && spyglassHint && <CompareHint>{spyglassHint}</CompareHint>}
    </div>
  );
}
