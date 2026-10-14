import { atom } from 'jotai';

// 画像のクリックを、推論タブのモデル（input: 'points'）に渡す。Viewer ごとの store に載る。
// 推論タブで「クリックで切り出す」を始めると picker が入り、画像の上の層（overlays/PointPickOverlay）がクリックを拾う。

/** `new`: a new thing. `add` / `remove`: the last thing also covers / does not cover this point. */
export type PickMode = 'new' | 'add' | 'remove';

export interface CanvasBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** A click on the image, in Canvas coordinates, with the part of the Canvas shown on screen. */
export interface PickedPoint {
  x: number;
  y: number;
  view: CanvasBox;
  mode: PickMode;
}

export interface PointPicker {
  canvasId: string;
  onPoint: (p: PickedPoint) => void;
}

export const pointPickerAtom = atom<PointPicker | null>(null);

/** The clicks of the thing being outlined (Canvas coordinates), drawn as dots. */
export const pickedMarksAtom = atom<{ canvasId: string; points: { x: number; y: number; positive: boolean }[] } | null>(null);
