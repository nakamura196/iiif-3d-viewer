import { atom } from 'jotai';
import type { ImageRegion } from '../../core';

// 画像の表示中の範囲を、推論タブに渡す。Viewer ごとの store に載る。
// 画像の上の層（overlays/ViewRegionOverlay）が Canvas ごとに読み取り口を置き、推論タブは押したときにだけ読む
// （拡大・移動のたびに書き換えると、推論タブまで描き直しになるため）。

export interface ViewReader {
  canvasId: string;
  /** The part of the Canvas on screen now (Canvas coordinates, clamped to the Canvas). */
  read: () => ImageRegion;
}

export const viewReaderAtom = atom<ViewReader | null>(null);
