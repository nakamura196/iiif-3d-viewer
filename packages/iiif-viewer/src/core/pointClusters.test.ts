import { describe, expect, it } from 'vitest';
import { clusterExpansionScale, clusterLevelScale, clusterPoints } from './pointClusters';

const p = (id: string, x: number, y: number) => ({ id, x, y });

describe('clusterPoints', () => {
  it('puts points closer than the radius on screen into one cluster', () => {
    // 1 Canvas unit = 0.1 px: 100 units apart is 10 px, 1000 units apart is 100 px
    const c = clusterPoints([p('a', 0, 0), p('b', 100, 0), p('c', 1000, 0)], 0.1, 50);
    expect(c.map((k) => k.ids)).toEqual([['a', 'b'], ['c']]);
    expect(c[0]).toMatchObject({ x: 50, y: 0, minX: 0, maxX: 100 });
  });

  it('splits the same points when zoomed in', () => {
    const c = clusterPoints([p('a', 0, 0), p('b', 100, 0)], 1, 50);
    expect(c).toHaveLength(2);
  });

  it('finds neighbours across grid cells', () => {
    // 49 and 51 fall in different cells of size 50, but are 2 px apart
    const c = clusterPoints([p('a', 49, 0), p('b', 51, 0)], 1, 50);
    expect(c.map((k) => k.ids)).toEqual([['a', 'b']]);
  });

  it('keeps every point exactly once', () => {
    const pts = Array.from({ length: 2000 }, (_, i) => p(String(i), (i * 7919) % 1000, (i * 104729) % 1000));
    const ids = clusterPoints(pts, 0.5, 40).flatMap((k) => k.ids);
    expect(ids).toHaveLength(2000);
    expect(new Set(ids).size).toBe(2000);
  });

  it('skips points that are not numbers', () => {
    expect(clusterPoints([p('a', 0, 0), p('b', NaN, 0)], 1, 50).flatMap((k) => k.ids)).toEqual(['a']);
  });
});

describe('clusterLevelScale', () => {
  it('rounds the zoom to half octaves', () => {
    expect(clusterLevelScale(1)).toBeCloseTo(1);
    expect(clusterLevelScale(1.1)).toBeCloseTo(1);
    expect(clusterLevelScale(1.3)).toBeCloseTo(Math.SQRT2);
    expect(clusterLevelScale(3.9)).toBeCloseTo(4);
  });
});

describe('clusterExpansionScale', () => {
  const box = { w: 800, h: 600 };
  it('zooms so that the cluster fills half the box', () => {
    // the points spread 30 px at scale 1; half of 600 px is 300 px, so 10 times
    const c = clusterPoints([p('a', 0, 0), p('b', 30, 0)], 1, 50)[0];
    expect(clusterExpansionScale(c, 1, box, 1, 20, 50)).toBeCloseTo(10);
  });

  it('zooms at least twice', () => {
    const c = clusterPoints([p('a', 0, 0), p('b', 30, 0)], 1, 50)[0];
    expect(clusterExpansionScale(c, 1, box, 8, 20, 50)).toBeCloseTo(16);
  });

  it('gives up on points at the same place, or still within the radius at the deepest zoom', () => {
    const same = clusterPoints([p('a', 5, 5), p('b', 5, 5)], 1, 50)[0];
    expect(clusterExpansionScale(same, 1, box, 1, 20, 50)).toBeNull();
    const near = clusterPoints([p('a', 0, 0), p('b', 2, 0)], 1, 50)[0];
    expect(clusterExpansionScale(near, 1, box, 1, 20, 50)).toBeNull();
  });
});
