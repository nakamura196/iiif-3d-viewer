'use client';

import { useEffect, useRef } from 'react';
import { useSetAtom } from 'jotai';
import { viewReaderAtom } from '../inference/viewState';
import { visibleBoxOf } from './annotationMarks';
import type { Overlay, OverlayProps } from './types';

// 何も描かない層。いま画面に映っている Canvas の範囲を、推論タブの「表示中の範囲で実行」に読ませる。

function ViewRegionView({ container, canvasWidth, canvasHeight, stage }: OverlayProps) {
  const setReader = useSetAtom(viewReaderAtom);
  const latest = useRef({ stage, canvasWidth, canvasHeight });
  useEffect(() => {
    latest.current = { stage, canvasWidth, canvasHeight };
  });
  const canvasId = container.id;
  useEffect(() => {
    const reader = {
      canvasId,
      read: () => visibleBoxOf(latest.current.stage, latest.current.canvasWidth, latest.current.canvasHeight),
    };
    setReader(reader);
    return () => setReader((r) => (r === reader ? null : r));
  }, [canvasId, setReader]);
  return null;
}

export const viewRegionOverlay: Overlay = {
  id: 'view-region',
  available: () => true,
  Component: ViewRegionView,
};
