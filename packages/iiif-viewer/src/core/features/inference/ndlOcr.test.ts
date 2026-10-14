import { describe, expect, it } from 'vitest';
import { ndlFirstRecognizer, ndlOcrLines, ndlParseqTensor, resizeLinearCv } from '..';
// 原本 ndlocr-lite の ocr.py に同じ画像を読ませたときの、検出の出力と LINE の並び（行の枠だけ）
import fixture from './fixtures/ndlocr-lite-layout.json';

describe('NDLOCR-Lite の行と読む順（原本の ocr.py の結果と同じ）', () => {
  for (const [name, f] of Object.entries(fixture)) {
    it(`${name}: ${f.source}`, () => {
      const lines = ndlOcrLines(f.labels, f.boxes, f.scores, f.charCount, f.width, f.height);
      expect(lines.map((l) => [l.x, l.y, l.w, l.h])).toEqual(f.lines);
    });
  }
  it('検出が無ければ行も無い', () => {
    expect(ndlOcrLines([], [], [], [], 100, 100)).toEqual([]);
  });
});

describe('NDLOCR-Lite の文字の読み取りの前処理', () => {
  it('文字数の見込みで最初に使うモデルを選ぶ', () => {
    expect([3, 2, 1, 100].map(ndlFirstRecognizer)).toEqual([0, 1, 2, 2]);
  });
  it('幅の 0.8 倍より高い行は回す（3×16×W、-1〜1）', () => {
    const px = new Uint8ClampedArray(10 * 9 * 4).fill(255);
    const t = ndlParseqTensor(px, 10, 9, 256);
    expect(t.length).toBe(3 * 16 * 256);
    expect(t.every((v) => Math.abs(v - 1) < 1e-6)).toBe(true);
  });
  it('OpenCV の INTER_LINEAR と同じ値（cv2.resize で求めた値）', () => {
    // 3×2 の画像を 4×3 に。cv2.resize(img, (4, 3), interpolation=cv2.INTER_LINEAR) の R
    const R = [0, 100, 200, 50, 150, 250];
    const px = new Uint8ClampedArray(3 * 2 * 4);
    R.forEach((v, i) => (px[i * 4] = v));
    const out = resizeLinearCv(px, 3, 2, 4, 3);
    expect(Array.from({ length: 12 }, (_, i) => out[i * 4])).toEqual([0, 62, 137, 200, 25, 88, 163, 225, 50, 112, 187, 250]);
  });
});
