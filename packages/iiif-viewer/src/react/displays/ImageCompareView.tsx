'use client';

import { useMemo, useRef, useState } from 'react';
import { canvasImagesOf, compareDetailWidthOf, fitSide, rawCanvasOf, type CanvasImages, type CompareSide } from '../../core';
import {
  CompareChip,
  CompareHint,
  LensRing,
  SwipeHandle,
  compareClipOf,
  pointInBox,
  type CompareMode,
  type LensPoint,
  type SwipeDirection,
} from '../compare/CompareParts';
import { ImageLayers } from './ImageTiles';
import ImageView, { INITIAL_VIEW, stageStyleOf, zoomStageAt, type StageInfo, type ViewState } from './ImageView';
import { useRawManifest } from './rawManifest';

// 2 つの画像（Choice の 2 つの候補、または別々の資料の画像）を見比べる。
// 枠は A の大きさ。B は縦横比を保って A の枠に収め、中央に置く（大きさの違う 2 枚でも、拡大・移動が揃う）。
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
  /** The two sides (A, B). A's size is the frame; see `choiceSidesOf` for a Choice of one Canvas. */
  sides: [CompareSide, CompareSide];
  mode: CompareMode;
  labels: [string, string];
  /** Spyglass magnification of B (1 = the same scale as A). */
  zoom?: number;
  /** Overlay: opacity of B (0 to 1). */
  opacity?: number;
  /** Accessible name of the swipe line, and the hint shown in spyglass mode. */
  swipeHandleLabel?: string;
  spyglassHint?: string;
  /** Swipe: B is right of a vertical line (default) or below a horizontal line. */
  swipeDirection?: SwipeDirection;
}

export default function ImageCompareView({
  sides,
  mode,
  labels,
  zoom = 1,
  opacity = 0.5,
  swipeHandleLabel,
  spyglassHint,
  swipeDirection = 'horizontal',
}: ImageCompareViewProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<ViewState>(INITIAL_VIEW);
  const [split, setSplit] = useState(50); // swipe line, % from the left
  const [lens, setLens] = useState<LensPoint | null>(null);

  const { width, height } = sides[0];
  const b = useMemo(() => fitSide(sides[1], sides[0]), [sides]);
  const layers = [sides[0].layers, b.layers];
  const detail = compareDetailWidthOf(sides[0], b);

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
        style={mode === 'overlay' ? { opacity } : { clipPath: compareClipOf(mode, split, at, swipeDirection) }}
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
      {mode === 'swipe' && swipeDirection === 'vertical' ? (
        <CompareChip className="left-3" bottom>
          B: {labels[1]}
        </CompareChip>
      ) : (
        <CompareChip className="right-3">B: {labels[1]}</CompareChip>
      )}
      {mode === 'spyglass' && <LensRing lens={lens} />}
      {mode === 'swipe' && (
        <SwipeHandle boxRef={boxRef} split={split} onSplit={setSplit} label={swipeHandleLabel} direction={swipeDirection} />
      )}
      {mode === 'spyglass' && spyglassHint && <CompareHint>{spyglassHint}</CompareHint>}
    </div>
  );
}
