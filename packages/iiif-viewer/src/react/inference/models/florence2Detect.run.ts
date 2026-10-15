import type { Detection } from '../../../core';
import { florence2Task } from './florence2.shared';
import type { ModelRunner } from './types';

// 物の検出（<OD>）。名前は英語。Florence-2 は確からしさを返さないので score は 1
export const run: ModelRunner = async (ctx) => {
  const r = (await florence2Task(ctx, '<OD>', 1024)) as { bboxes?: number[][]; labels?: string[] } | undefined;
  const items: Detection[] = (r?.bboxes ?? []).map(([x1, y1, x2, y2], i) => ({
    x: x1,
    y: y1,
    w: x2 - x1,
    h: y2 - y1,
    score: 1,
    label: r?.labels?.[i] ?? '',
  }));
  return { kind: 'regions', items, imageWidth: ctx.bitmap.width, imageHeight: ctx.bitmap.height };
};
