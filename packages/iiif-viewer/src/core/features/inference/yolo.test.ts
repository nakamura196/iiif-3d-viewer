import { describe, expect, it } from 'vitest';
import { yoloDecode, yoloPlace, yoloTiles } from '..';

describe('YOLO', () => {
  it('入力に収まる画像は全体 1 枚だけ。大きい画像は全体のあとに重ねて切る', () => {
    expect(yoloTiles(1000, 800, 1280)).toHaveLength(1);
    const t = yoloTiles(2560, 1707, 1280);
    expect(t[0]).toMatchObject({ sx: 0, sy: 0, sw: 2560, sh: 1707, scale: 0.5 });
    expect(t.slice(1).map((p) => [p.sx, p.sy])).toEqual([
      [0, 0], [1024, 0], [1280, 0],
      [0, 427], [1024, 427], [1280, 427],
    ]);
    expect(t.slice(1).every((p) => p.sw === 1280 && p.sh === 1280)).toBe(true);
  });

  it('入力の座標を、中央に置いた余白と縮めた分を戻して画像の画素にする', () => {
    // 200 x 100 の画像を 100 角に置く: 0.5 倍、上下に 25 の余白
    const at = yoloPlace(0, 0, 200, 100, 100);
    expect(at).toMatchObject({ scale: 0.5, padLeft: 0, padTop: 25 });
    // 2 つの候補（n = 2）、1 クラス: 1 つ目だけ下限を超える
    const data = [50, 10, 50, 10, 20, 2, 10, 2, 0.9, 0.1];
    const boxes: number[] = [];
    const scores: number[] = [];
    const classes: number[] = [];
    yoloDecode(data, 5, 2, at, 0.25, boxes, scores, classes);
    expect(boxes).toEqual([80, 40, 120, 60]);
    expect(scores).toEqual([0.9]);
    expect(classes).toEqual([0]);
  });

  it('切った分の座標は、切った位置を足して戻し、はみ出しは切り詰める', () => {
    const at = yoloPlace(1000, 500, 100, 100, 100);
    const boxes: number[] = [];
    yoloDecode([95, 50, 20, 10, 0.5], 5, 1, at, 0.25, boxes, [], []);
    expect(boxes).toEqual([1085, 545, 1100, 555]);
  });
});
