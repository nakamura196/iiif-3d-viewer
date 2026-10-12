'use client';

import { createContext, useContext } from 'react';

// パネルから「この Canvas へ移動する」を呼ぶための口。
// 注釈のリンク本文が同じ資料の Canvas id のとき、クリックでそこへ移る。
export interface CanvasNavigation {
  /** Move to the Canvas with this id. Returns false when the id is not a Canvas of this item. */
  goToCanvas: (canvasId: string) => boolean;
}

const fallback: CanvasNavigation = { goToCanvas: () => false };

export const CanvasNavigationContext = createContext<CanvasNavigation>(fallback);
export const useCanvasNavigation = (): CanvasNavigation => useContext(CanvasNavigationContext);

/** Index of the container with this id, or -1. */
export const indexOfCanvas = (containers: ReadonlyArray<{ id: string }>, canvasId: string): number =>
  containers.findIndex((c) => c.id === canvasId);
