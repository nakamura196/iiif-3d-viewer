'use client';

import { useEffect, useRef, useState } from 'react';
import { detailWidthOf, type CanvasImages, type ImageLayer } from '../../core';
import { ImageLayers } from '../displays/ImageTiles';
import ImageView, { INITIAL_VIEW, type StageInfo, type ViewState } from '../displays/ImageView';

// ジオリファレンスの画面（/georef）で、地点の付いた画像（絵図・古地図）を出す。
// 地点（resourceCoords の x, y）を画像の上に印で出し、印を押すと onSelect を呼ぶ。
// selectedId が変わると、その地点が画面の真ん中に来るよう画像を動かす（地図・一覧からの連動）。

export interface GeoImagePoint {
  id: string;
  title: string;
  /** Canvas 座標。 */
  x: number;
  y: number;
}

export interface GeoImageViewProps {
  canvas: CanvasImages;
  points: GeoImagePoint[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/** How far to zoom in, at least, when a point is chosen from the map or the list. */
const FOCUS_SCALE = 4;

const MARKER = 14;

// The view that puts Canvas point (x, y) at the middle of the box.
// The stage is centred in the box and scaled around its centre, so a point at stage offset d
// (from the stage centre) shows at tx + scale * d from the box centre.
export const centerOn = (stage: StageInfo, cw: number, ch: number, x: number, y: number, scale: number): ViewState => ({
  scale,
  tx: -scale * (x / cw - 0.5) * stage.stageW,
  ty: -scale * (y / ch - 0.5) * stage.stageH,
});

export default function GeoImageView({ canvas, points, selectedId, onSelect }: GeoImageViewProps) {
  const [view, setView] = useState<ViewState>(INITIAL_VIEW);
  const stageRef = useRef<StageInfo | null>(null);
  const layers: ImageLayer[] = canvas.paintings.flatMap((p) => p.options[0]?.layer ?? []);
  const width = canvas.width ?? layers[0]?.width;
  const height = canvas.height ?? layers[0]?.height;

  // 地図や一覧で選ばれた地点へ画像を動かす。画像の印を押したときも同じ動きになる。
  useEffect(() => {
    const stage = stageRef.current;
    const p = points.find((pt) => pt.id === selectedId);
    if (!stage || !p || !width || !height || stage.stageW === 0) return;
    setView((v) => centerOn(stage, width, height, p.x, p.y, Math.max(v.scale, FOCUS_SCALE)));
  }, [selectedId, points, width, height]);

  if (!width || !height) return null;

  return (
    <ImageView
      canvasWidth={width}
      canvasHeight={height}
      detailWidth={detailWidthOf(layers)}
      view={view}
      onViewChange={setView}
    >
      {(stage) => {
        stageRef.current = stage;
        return (
          <>
            <ImageLayers layers={layers} canvasWidth={width} canvasHeight={height} stage={stage} />
            {points.map((p, i) => {
              const selected = p.id === selectedId;
              return (
                <button
                  key={p.id}
                  type="button"
                  title={p.title}
                  aria-label={p.title}
                  aria-pressed={selected}
                  // 押したときに画像のドラッグが始まらないようにする
                  onPointerDown={(e) => e.stopPropagation()}
                  onDoubleClick={(e) => e.stopPropagation()}
                  onClick={() => onSelect(p.id)}
                  className={`absolute rounded-full border-2 border-white shadow flex items-center justify-center text-[9px] font-bold text-white ${
                    selected ? 'bg-red-500 z-10' : 'bg-blue-500 hover:bg-blue-600'
                  }`}
                  style={{
                    left: `${(p.x / width) * 100}%`,
                    top: `${(p.y / height) * 100}%`,
                    width: MARKER * (selected ? 1.6 : 1),
                    height: MARKER * (selected ? 1.6 : 1),
                    // 拡大しても印の大きさは画面上で一定にする
                    transform: `translate(-50%, -50%) scale(${1 / stage.scale})`,
                  }}
                >
                  {selected ? i + 1 : null}
                </button>
              );
            })}
          </>
        );
      }}
    </ImageView>
  );
}
