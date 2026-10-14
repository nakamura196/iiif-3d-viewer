import { sam2BoxInput, sam2Crop, sam2Outline, sam2Tensor, SAM2_SIZE, type Detection } from '../../../core';
import type { RunContext } from './types';

// SAM 2.1 で、枠ごとに中の物の輪郭を取る。枠のまわりを切り出して 1,024 角に引き伸ばし、エンコーダを 1 回、
// デコーダを 1 回流す（枠 1 つにつき 1 回ずつ）。必要なファイル: `sam-encoder` と `sam-decoder`。
// 輪郭が取れなかった枠は、枠のまま返す。

export const outlineBoxes = async ({ ort, bitmap, session, progress }: RunContext, items: Detection[]): Promise<Detection[]> => {
  if (!items.length) return items;
  const enc = await session('sam-encoder', 'webgpu');
  const dec = await session('sam-decoder', 'webgpu');
  const cv = new OffscreenCanvas(SAM2_SIZE, SAM2_SIZE);
  const c = cv.getContext('2d', { willReadFrequently: true })!;
  const out: Detection[] = [];
  for (let i = 0; i < items.length; i++) {
    progress('outline', i, items.length);
    const d = items[i];
    const box = { x0: d.x, y0: d.y, x1: d.x + d.w, y1: d.y + d.h };
    const crop = sam2Crop(box, bitmap.width, bitmap.height);
    c.drawImage(bitmap, crop.x0, crop.y0, crop.x1 - crop.x0, crop.y1 - crop.y0, 0, 0, SAM2_SIZE, SAM2_SIZE);
    const pixels = sam2Tensor(c.getImageData(0, 0, SAM2_SIZE, SAM2_SIZE).data);
    const e = await enc.session.run({ pixel_values: new ort.Tensor('float32', pixels, [1, 3, SAM2_SIZE, SAM2_SIZE]) });
    const r = await dec.session.run({
      input_points: new ort.Tensor('float32', new Float32Array(0), [1, 1, 0, 2]),
      input_labels: new ort.Tensor('int64', new BigInt64Array(0), [1, 1, 0]),
      input_boxes: new ort.Tensor('float32', Float32Array.from(sam2BoxInput(box, crop)), [1, 1, 4]),
      'image_embeddings.0': e['image_embeddings.0'],
      'image_embeddings.1': e['image_embeddings.1'],
      'image_embeddings.2': e['image_embeddings.2'],
    });
    const polygon = sam2Outline(r.pred_masks.data as Float32Array, r.iou_scores.data as Float32Array, crop);
    out.push(polygon ? { ...d, polygon } : d);
  }
  progress('outline', items.length, items.length);
  return out;
};
