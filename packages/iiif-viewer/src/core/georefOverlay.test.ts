import { describe, expect, it } from 'vitest';
import { fitAffine, overlayCorners, type ControlPoint } from './georefOverlay';

// 画像 1000 × 500 を、経度 139.70〜139.80・緯度 35.70〜35.65 の範囲に北を上にして貼った場合。
// 経度は Mercator でも線形なので x とそのまま比例する。緯度は四隅でだけ確かめる。
const corners: ControlPoint[] = [
  { resource: [0, 0], geo: [139.7, 35.7] },
  { resource: [1000, 0], geo: [139.8, 35.7] },
  { resource: [1000, 500], geo: [139.8, 35.65] },
  { resource: [0, 500], geo: [139.7, 35.65] },
];

describe('overlayCorners', () => {
  it('対応点が四隅なら、四隅をそのまま返す', () => {
    const out = overlayCorners(corners, 1000, 500)!;
    const expected = corners.map((p) => p.geo);
    out.forEach((c, i) => {
      expect(c[0]).toBeCloseTo(expected[i][0], 9);
      expect(c[1]).toBeCloseTo(expected[i][1], 9);
    });
  });

  it('対応点が内側だけでも、外側の隅を外挿する', () => {
    const affine = fitAffine(corners)!;
    // 四隅から作った変換で内側の 3 点を写し、それだけから四隅を求め直す
    const inner: ControlPoint[] = ([[200, 100], [800, 150], [400, 400]] as const).map(([x, y]) => {
      const [mx, my] = affine(x, y);
      return {
        resource: [x, y],
        geo: [(mx * 180) / Math.PI, (Math.atan(Math.exp(my)) * 360) / Math.PI - 90],
      };
    });
    const out = overlayCorners(inner, 1000, 500)!;
    out.forEach((c, i) => {
      expect(c[0]).toBeCloseTo(corners[i].geo[0], 9);
      expect(c[1]).toBeCloseTo(corners[i].geo[1], 9);
    });
  });

  it('対応点が 3 つ未満、または一直線なら null', () => {
    expect(overlayCorners(corners.slice(0, 2), 1000, 500)).toBeNull();
    const line: ControlPoint[] = [0, 1, 2].map((i) => ({ resource: [i * 10, i * 10], geo: [139 + i, 35 + i] }));
    expect(overlayCorners(line, 1000, 500)).toBeNull();
  });
});
