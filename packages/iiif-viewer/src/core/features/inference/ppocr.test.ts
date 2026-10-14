import { describe, expect, it } from 'vitest';
import { decodeCtc, ppocrBoxes, ppocrCrop, ppocrDetSize, ppocrQuadBox, ppocrRecTensor } from './ppocr';

describe('PP-OCR', () => {
  it('rounds the detection input to multiples of 32, keeping the size', () => {
    expect(ppocrDetSize(1234, 2048)).toEqual([1248, 2048]);
    expect(ppocrDetSize(40, 100)).toEqual([64, 160]);
  });

  it('finds a text line as a box widened by area * 1.5 / perimeter, in image pixels', () => {
    const dw = 64;
    const dh = 32;
    const prob = new Float32Array(dw * dh);
    for (let y = 10; y <= 19; y++) for (let x = 10; x <= 49; x++) prob[y * dw + x] = 0.9;
    // 小さすぎる点は捨てる
    prob[2 * dw + 2] = 0.9;
    const boxes = ppocrBoxes(prob, dw, dh, 128, 64);
    expect(boxes).toHaveLength(1);
    // 画素の中心どうしで 39 x 9、広げる幅 = 39 * 9 * 1.5 / 96 = 5.48
    const b = ppocrQuadBox(boxes[0].quad);
    expect(b.polygon).toBeUndefined();
    expect(b.x).toBe(Math.round((10 - 5.484375) * 2));
    expect(b.w).toBe(Math.round((49 + 5.484375) * 2) - b.x);
    expect(boxes[0].score).toBeCloseTo(0.9, 5);
  });

  it('turns a tall line to the left before reading', () => {
    const W = 10;
    const H = 30;
    const px = new Uint8ClampedArray(W * H * 4).fill(255);
    const c = ppocrCrop(px, W, H, [[0, 0], [10, 0], [10, 30], [0, 30]]);
    expect([c.w, c.h]).toEqual([30, 10]);
  });

  it('pads the recognition input to at least 320 wide', () => {
    const px = new Uint8ClampedArray(96 * 48 * 4).fill(255);
    const t = ppocrRecTensor(px, 96, 48);
    expect(t.width).toBe(320);
    expect(t.data[0]).toBe(1);
    expect(t.data[100]).toBe(0);
  });

  it('decodes CTC: repeats merged, blanks dropped, the last class is a space', () => {
    const chars = ['a', 'b'];
    const C = 4;
    const steps = [1, 1, 0, 1, 3, 2];
    const prob = new Float32Array(steps.length * C);
    steps.forEach((k, t) => (prob[t * C + k] = 0.5));
    expect(decodeCtc(prob, steps.length, C, chars)).toEqual({ text: 'aa b', score: 0.5 });
  });
});
