import { ppocrRead } from '../../../core';
import type { ModelRunner } from './types';

// PP-OCRv5 の 2 つの版（ppocrV5.run・ppocrV5Latin.run）で共通の手順。違うのは読み取りのモデルと字の一覧だけ。
export const ppocrRunner =
  (chars: string[]): ModelRunner =>
  async ({ ort, bitmap, session, progress }) => {
    const W = bitmap.width;
    const H = bitmap.height;
    const cv = new OffscreenCanvas(W, H);
    const c = cv.getContext('2d', { willReadFrequently: true })!;
    c.drawImage(bitmap, 0, 0);
    const page = c.getImageData(0, 0, W, H).data;
    const lines = await ppocrRead(page, W, H, chars, {
      detect: async (input, dw, dh) => {
        const det = await session('detector', 'webgpu');
        const r = await det.session.run({ [det.session.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, dh, dw]) });
        return r[det.session.outputNames[0]].data as Float32Array;
      },
      // 読み取りは wasm。行ごとに入力の幅が変わり、WebGPU では形が変わるたびに準備し直しになる
      recognize: async (input, width) => {
        const rec = await session('recognizer', 'wasm');
        const r = await rec.session.run({ [rec.session.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, 48, width]) });
        const o = r[rec.session.outputNames[0]];
        return { data: o.data as Float32Array, T: o.dims[1], C: o.dims[2] };
      },
      progress,
    });
    return {
      kind: 'lines',
      items: lines.map(({ x, y, w, h, polygon, score, text }) => ({ x, y, w, h, score, text, ...(polygon ? { polygon } : {}) })),
      imageWidth: W,
      imageHeight: H,
    };
  };
