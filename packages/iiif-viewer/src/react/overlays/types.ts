import type { ComponentType } from 'react';
import type { ContainerInfo } from '../../core';
import type { StageInfo } from '../displays/ImageView';

// 画像の上に重ねる表示（注釈の枠・点・ホットスポットなど）の契約。
// 重ねる層は「画像と同じ大きさの透明な箱」で、画像のズーム・移動に追従する（担当: image）。
// 位置は Canvas 座標の割合（x / canvasWidth * 100%）で置く。
export interface OverlayProps {
  container: ContainerInfo;
  canvasWidth: number;
  canvasHeight: number;
  /** The current zoom and move of the view (to draw only what is on screen). */
  stage?: StageInfo;
}

export interface Overlay {
  id: string;
  /** Drawing order, smaller first (below). Without it the overlay goes on top. */
  order?: number;
  /** Whether this overlay has anything to draw for the container. */
  available: (container: ContainerInfo) => boolean;
  Component: ComponentType<OverlayProps>;
}
