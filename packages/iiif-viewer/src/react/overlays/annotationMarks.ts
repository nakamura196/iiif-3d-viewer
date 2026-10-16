import type { CanvasAnnotation } from '../../core';
import type { StageInfo } from '../displays/ImageView';

/** A rectangle in Canvas coordinates. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

// 注釈の印をいくつまで押せる印（DOM）で描くか。これを超えると 1 枚の canvas にまとめて描く。
// 2 万件を DOM で描くと、拡大 1 段ごとに 190ms かかった（線の太さが拡大率で決まるため、全部を描き直す）。
export const DOM_MARK_LIMIT = 500;

/** The part of the Canvas on screen (clamped to the Canvas), or the whole Canvas without a stage. */
export const visibleBoxOf = (
  stage: StageInfo | undefined,
  canvasWidth: number,
  canvasHeight: number,
  margin = 0,
): Box => {
  const whole = { x: 0, y: 0, w: canvasWidth, h: canvasHeight };
  if (!stage || !(stage.stageW > 0) || !(stage.scale > 0) || !(stage.boxW > 0)) return whole;
  // A point of the box is (b - box/2 - t) / scale + stage/2 in the stage (the transform origin is the centre).
  const toCanvas = canvasWidth / stage.stageW;
  const halfW = (stage.boxW / 2) * (1 + margin);
  const halfH = (stage.boxH / 2) * (1 + margin);
  const x0 = ((-halfW - stage.tx) / stage.scale + stage.stageW / 2) * toCanvas;
  const x1 = ((halfW - stage.tx) / stage.scale + stage.stageW / 2) * toCanvas;
  const y0 = ((-halfH - stage.ty) / stage.scale + stage.stageH / 2) * toCanvas;
  const y1 = ((halfH - stage.ty) / stage.scale + stage.stageH / 2) * toCanvas;
  const x = Math.max(0, x0);
  const y = Math.max(0, y0);
  return { x, y, w: Math.max(0, Math.min(canvasWidth, x1) - x), h: Math.max(0, Math.min(canvasHeight, y1) - y) };
};

/** Screen pixels per Canvas unit at the current zoom. */
export const pixelsPerUnit = (stage: StageInfo | undefined, canvasWidth: number): number =>
  stage && stage.stageW > 0 ? (stage.stageW / canvasWidth) * stage.scale : 1;

/** The box of an annotation's region in Canvas coordinates (a point has no size). */
export const boxOfRegion = (a: CanvasAnnotation): Box | null => {
  const r = a.region;
  if (r.type === 'rect') return { x: r.x, y: r.y, w: r.w, h: r.h };
  if (r.type === 'polygon') return r.bbox;
  if (r.type === 'point') return { x: r.x, y: r.y, w: 0, h: 0 };
  return null;
};

/** Whether two boxes touch (a box without size counts when it lies on the other). */
export const overlaps = (a: Box, b: Box): boolean =>
  a.x <= b.x + b.w && b.x <= a.x + a.w && a.y <= b.y + b.h && b.y <= a.y + a.h;
