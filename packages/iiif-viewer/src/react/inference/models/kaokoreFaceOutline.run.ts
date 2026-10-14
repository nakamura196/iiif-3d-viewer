import { detectFaces } from './kaokoreFace.run';
import { outlineBoxes } from './sam2.run';
import type { ModelRunner } from './types';

// 顔を探して（kaokoreFace と同じ）、見つけた枠ごとに SAM 2.1 で顔の輪郭を取る
export const run: ModelRunner = async (ctx) => ({
  kind: 'regions',
  items: await outlineBoxes(ctx, await detectFaces(ctx)),
  imageWidth: ctx.bitmap.width,
  imageHeight: ctx.bitmap.height,
});
