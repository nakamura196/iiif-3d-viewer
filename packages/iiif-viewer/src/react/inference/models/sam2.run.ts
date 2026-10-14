import {
  sam2BoxInput,
  sam2Crop,
  sam2Outline,
  sam2PointInput,
  sam2Tensor,
  SAM2_SIZE,
  type Detection,
  type Sam2Box,
} from '../../../core';
import type { OrtTensor } from '../ort';
import type { PointPrompt, RunContext } from './types';

// SAM 2.1 で、枠ごと・クリックごとに物の輪郭を取る。画像の一部を切り出して 1,024 角に引き伸ばし、
// エンコーダ（画像を読む。重い）を 1 回、デコーダ（枠や点から形を出す。軽い）を 1 回流す。
// 必要なファイル: `sam-encoder` と `sam-decoder`。

type Embeddings = Record<'image_embeddings.0' | 'image_embeddings.1' | 'image_embeddings.2', OrtTensor>;

// クリックでは同じ画像の同じ部分を何度も読むので、最後に読んだ 1 つを持っておく（Worker が生きている間）
let lastRead: { key: string; emb: Embeddings } | null = null;

const embed = async ({ ort, bitmap, session }: RunContext, crop: Sam2Box): Promise<Embeddings> => {
  const enc = await session('sam-encoder', 'webgpu');
  const cv = new OffscreenCanvas(SAM2_SIZE, SAM2_SIZE);
  const c = cv.getContext('2d', { willReadFrequently: true })!;
  c.drawImage(bitmap, crop.x0, crop.y0, crop.x1 - crop.x0, crop.y1 - crop.y0, 0, 0, SAM2_SIZE, SAM2_SIZE);
  const pixels = sam2Tensor(c.getImageData(0, 0, SAM2_SIZE, SAM2_SIZE).data);
  const e = await enc.session.run({ pixel_values: new ort.Tensor('float32', pixels, [1, 3, SAM2_SIZE, SAM2_SIZE]) });
  return {
    'image_embeddings.0': e['image_embeddings.0'],
    'image_embeddings.1': e['image_embeddings.1'],
    'image_embeddings.2': e['image_embeddings.2'],
  };
};

// 枠ごとに、枠のまわりを切り出して輪郭を取る。輪郭が取れなかった枠は、枠のまま返す。
export const outlineBoxes = async (ctx: RunContext, items: Detection[]): Promise<Detection[]> => {
  if (!items.length) return items;
  const { ort, bitmap, session, progress } = ctx;
  const dec = await session('sam-decoder', 'webgpu');
  const out: Detection[] = [];
  for (let i = 0; i < items.length; i++) {
    progress('outline', i, items.length);
    const d = items[i];
    const box = { x0: d.x, y0: d.y, x1: d.x + d.w, y1: d.y + d.h };
    const crop = sam2Crop(box, bitmap.width, bitmap.height);
    const r = await dec.session.run({
      input_points: new ort.Tensor('float32', new Float32Array(0), [1, 1, 0, 2]),
      input_labels: new ort.Tensor('int64', new BigInt64Array(0), [1, 1, 0]),
      input_boxes: new ort.Tensor('float32', Float32Array.from(sam2BoxInput(box, crop)), [1, 1, 4]),
      ...(await embed(ctx, crop)),
    });
    const polygon = sam2Outline(r.pred_masks.data as Float32Array, r.iou_scores.data as Float32Array, crop);
    out.push(polygon ? { ...d, polygon } : d);
  }
  progress('outline', items.length, items.length);
  return out;
};

/**
 * The thing at the clicks, as one region with its outline (null when SAM finds nothing there). The part `crop` of
 * the image is read once and kept, so more clicks on the same part only run the decoder.
 */
export const outlinePoints = async (ctx: RunContext, prompt: PointPrompt): Promise<Detection | null> => {
  const { ort, session, progress, imageKey } = ctx;
  const { points, crop } = prompt;
  const key = imageKey ? `${imageKey}|${crop.x0},${crop.y0},${crop.x1},${crop.y1}` : null;
  let emb = key && lastRead?.key === key ? lastRead.emb : null;
  if (!emb) {
    progress('encode', 0, 1);
    emb = await embed(ctx, crop);
    lastRead = key ? { key, emb } : null;
  }
  progress('segment', 0, 1);
  const dec = await session('sam-decoder', 'webgpu');
  const { coords, labels } = sam2PointInput(points, crop);
  // 枠は渡さない（0 個）。点だけで動くことは Python の onnxruntime で確かめた（docs/notes/browser-inference.md）
  const r = await dec.session.run({
    input_points: new ort.Tensor('float32', Float32Array.from(coords), [1, 1, points.length, 2]),
    input_labels: new ort.Tensor('int64', BigInt64Array.from(labels.map(BigInt)), [1, 1, points.length]),
    input_boxes: new ort.Tensor('float32', new Float32Array(0), [1, 0, 4]),
    ...emb,
  });
  const iou = r.iou_scores.data as Float32Array;
  const polygon = sam2Outline(r.pred_masks.data as Float32Array, iou, crop);
  if (!polygon) return null;
  const xs = polygon.map((p) => p[0]);
  const ys = polygon.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y, score: Math.max(...iou), polygon };
};
