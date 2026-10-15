import { describe, expect, it } from 'vitest';
import {
  decodeParseq,
  imageToCanvasOf,
  kotenLines,
  nms,
  parseqTensor,
  readCanvasAnnotations,
  resizeRgba,
  toAnnotationPage,
  toPlainText,
  type InferenceOutput,
} from '..';

describe('NMS', () => {
  it('重なった枠は確からしい方を残す。下限以下と上限を超える分は捨てる', () => {
    const boxes = [0, 0, 10, 10, 1, 1, 11, 11, 20, 20, 30, 30, 40, 40, 50, 50];
    const scores = [0.9, 0.8, 0.7, 0.2];
    expect(nms(boxes, scores, { iou: 0.5, scoreMin: 0.3 })).toEqual([0, 2]);
    expect(nms(boxes, scores, { iou: 0.5, scoreMin: 0.3, maxKeep: 1 })).toEqual([0]);
  });
});

describe('PARSeq', () => {
  it('位置ごとに一番の字を取り、止まりの記号（0）で終える', () => {
    // 4 positions x 3 classes: [a, b, end, a]
    const logits = [0, 5, 1, 0, 1, 5, 9, 0, 0, 0, 9, 0];
    expect(decodeParseq(logits, 4, ['あ', 'い'])).toBe('あい');
  });
  it('縦長の行は回して横長の入力にする（3×H×W、-1〜1）', () => {
    const w = 4;
    const h = 20;
    const px = new Uint8ClampedArray(w * h * 4).fill(255);
    const t = parseqTensor(px, w, h, 16, 8);
    expect(t.length).toBe(3 * 16 * 8);
    expect(t.every((v) => Math.abs(v - 1) < 1e-6)).toBe(true);
  });
  it('同じ大きさなら縮めない', () => {
    const px = new Uint8ClampedArray(2 * 2 * 4).map((_, i) => i);
    expect(resizeRgba(px, 2, 2, 2, 2)).toBe(px);
  });
});

describe('NDL古典籍OCR-Lite の行', () => {
  it('しきい値・画像の大きさへの戻し・上下 2% の余白・読む順', () => {
    // 2048 x 1024 の画像。1024 角の入力では 1 画素 = 2 画素
    const boxes = [
      100, 10, 120, 400, // 左の行
      300, 10, 320, 400, // 右の行（縦書きなので先に読む）
      300, 10, 319, 399, // 右の行と重なる（消える）
      0, 0, 1, 1, // 小さすぎる
    ];
    const scores = [0.9, 0.8, 0.7, 0.95];
    const lines = kotenLines(boxes, scores, 2048, 1024);
    expect(lines.map((l) => l.x)).toEqual([600, 200]);
    expect(lines[0]).toMatchObject({ y: 4, w: 40, h: 811 }); // y: 20 - 15.6、下: 800 + 15.6
  });
});

describe('AnnotationPage への書き出し', () => {
  const out: InferenceOutput = {
    kind: 'lines',
    items: [
      { x: 10, y: 20, w: 30, h: 40, score: 0.9, text: '一行目' },
      { x: 0, y: 0, w: 5, h: 5, score: 0.9, text: '' },
    ],
    imageWidth: 100,
    imageHeight: 200,
    language: 'ja',
  };
  const canvasId = 'https://example.org/canvas/1';
  let n = 0;
  const page = toAnnotationPage(out, {
    canvasId,
    map: imageToCanvasOf({ rotation: 0, mirror: false }, { width: 1000, height: 2000 }, 100, 200)!,
    newId: () => `urn:test:${n++}`,
    generator: { id: 'https://huggingface.co/x', name: 'Model' },
  });

  it('Canvas 座標の xywh、supplementing、空の行は出さない', () => {
    const items = page.items as Record<string, unknown>[];
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      motivation: 'supplementing',
      target: `${canvasId}#xywh=100,200,300,400`,
      body: { value: '一行目', language: 'ja' },
    });
  });
  it('ビューアの注釈の読み取りで、そのまま読める', () => {
    const annos = readCanvasAnnotations(canvasId, [page]);
    expect(annos).toHaveLength(1);
    expect(annos[0].region).toEqual({ type: 'rect', x: 100, y: 200, w: 300, h: 400 });
    expect(annos[0].bodies[0].value).toBe('一行目');
  });
  it('テキスト', () => {
    expect(toPlainText(out)).toBe('一行目');
  });
  it('画像全体の説明文は describing、target は画像全体', () => {
    const desc = toAnnotationPage(
      { kind: 'description', items: [{ x: 0, y: 0, w: 100, h: 200, score: 1, text: 'A street.' }], imageWidth: 100, imageHeight: 200, language: 'en' },
      { canvasId, map: imageToCanvasOf({ rotation: 0, mirror: false }, { width: 1000, height: 2000 }, 100, 200)!, newId: () => 'urn:test:d', generator: { id: 'x', name: 'M' } },
    );
    expect((desc.items as Record<string, unknown>[])[0]).toMatchObject({
      motivation: 'describing',
      target: `${canvasId}#xywh=0,0,1000,2000`,
      body: { value: 'A street.', language: 'en' },
    });
  });
  it('切り抜き・回転した画像は扱わない', () => {
    expect(imageToCanvasOf({ rotation: 90, mirror: false }, { width: 1, height: 1 }, 1, 1)).toBeNull();
    expect(imageToCanvasOf({ regionSpec: '0,0,10,10', rotation: 0, mirror: false }, { width: 1, height: 1 }, 1, 1)).toBeNull();
    expect(imageToCanvasOf({ target: { x: 5, y: 6, w: 50, h: 60 }, rotation: 0, mirror: false }, {}, 10, 10)).toEqual({
      x: 5,
      y: 6,
      scaleX: 5,
      scaleY: 6,
    });
  });
});
