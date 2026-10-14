import { nms, yoloDecode, yoloTensor, yoloTiles } from '../../../core';
import type { ModelRunner } from './types';

// 入力は 1,280 角の固定（書き出しが dynamic でない）。1 回に 1 枚ずつ流す
const SIZE = 1280;

export const run: ModelRunner = async ({ ort, bitmap, session, progress }) => {
  const W = bitmap.width;
  const H = bitmap.height;
  const tiles = yoloTiles(W, H, SIZE);
  const det = await session('detector', 'webgpu');
  const cv = new OffscreenCanvas(SIZE, SIZE);
  const c = cv.getContext('2d', { willReadFrequently: true })!;
  const boxes: number[] = [];
  const scores: number[] = [];
  const classes: number[] = [];
  for (let i = 0; i < tiles.length; i++) {
    progress('scan', i, tiles.length);
    const at = tiles[i];
    // Ultralytics と同じく、余白は灰色（114）
    c.fillStyle = 'rgb(114,114,114)';
    c.fillRect(0, 0, SIZE, SIZE);
    c.drawImage(bitmap, at.sx, at.sy, at.sw, at.sh, at.padLeft, at.padTop, Math.round(at.sw * at.scale), Math.round(at.sh * at.scale));
    const input = yoloTensor(c.getImageData(0, 0, SIZE, SIZE).data, SIZE);
    const r = await det.session.run({ [det.session.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, SIZE, SIZE]) });
    const out = r[det.session.outputNames[0]];
    yoloDecode(out.data as Float32Array, out.dims[1], out.dims[2], at, 0.25, boxes, scores, classes);
  }
  progress('scan', tiles.length, tiles.length);
  // 全体と切った分で同じ顔が重なるので、まとめて間引く（face-web と同じ 0.3）
  const keep = nms(boxes, scores, { iou: 0.3, scoreMin: 0.25 });
  const items = keep.map((k) => ({
    x: boxes[k * 4],
    y: boxes[k * 4 + 1],
    w: boxes[k * 4 + 2] - boxes[k * 4],
    h: boxes[k * 4 + 3] - boxes[k * 4 + 1],
    score: scores[k],
    label: 'face',
  }));
  return { kind: 'regions', items, imageWidth: W, imageHeight: H };
};
