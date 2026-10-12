import type { ComponentType } from 'react';
import type { ContainerInfo } from '../../core';

// 画像の上に重ねる表示（注釈の枠・点・ホットスポットなど）の契約。
// 重ねる層は「画像と同じ大きさの透明な箱」で、画像のズーム・移動に追従する（担当: image）。
// 位置は Canvas 座標の割合（x / canvasWidth * 100%）で置く。
export interface OverlayProps {
  container: ContainerInfo;
  canvasWidth: number;
  canvasHeight: number;
}

export interface Overlay {
  id: string;
  /** Whether this overlay has anything to draw for the container. */
  available: (container: ContainerInfo) => boolean;
  Component: ComponentType<OverlayProps>;
}
