import { outlinePoints } from './sam2.run';
import type { ModelRunner } from './types';

// クリックした点（と、直前の形に足し引きした点）から、物の輪郭を 1 つ取る。見つからなければ 0 件。
export const run: ModelRunner = async (ctx) => {
  if (!ctx.prompt?.points.length) throw new Error('No click');
  const item = await outlinePoints(ctx, ctx.prompt);
  return { kind: 'regions', items: item ? [item] : [], imageWidth: ctx.bitmap.width, imageHeight: ctx.bitmap.height };
};
