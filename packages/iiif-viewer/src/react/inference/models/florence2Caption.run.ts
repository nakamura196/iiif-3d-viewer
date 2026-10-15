import { florence2Task } from './florence2.shared';
import type { ModelRunner } from './types';

// 画像全体の説明文（英語）。<MORE_DETAILED_CAPTION> は数文の段落を返す
export const run: ModelRunner = async (ctx) => {
  const text = String((await florence2Task(ctx, '<MORE_DETAILED_CAPTION>', 256)) ?? '').trim();
  const W = ctx.bitmap.width;
  const H = ctx.bitmap.height;
  return {
    kind: 'description',
    items: text ? [{ x: 0, y: 0, w: W, h: H, score: 1, text }] : [],
    imageWidth: W,
    imageHeight: H,
    language: 'en',
  };
};
