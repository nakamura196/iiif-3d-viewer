import { describe, expect, it } from 'vitest';
import { FIT_MARGIN, fitDistance, fitView, topView } from './viewCamera';

describe('fitDistance', () => {
  it('fits the sphere in the vertical field of view', () => {
    // fov 90°: half angle 45°, so the distance is r / sin 45° times the margin
    expect(fitDistance(10, 90)).toBeCloseTo((10 / Math.SQRT1_2) * FIT_MARGIN);
  });

  it('uses the horizontal field of view when the canvas is taller than wide', () => {
    expect(fitDistance(10, 50, 0.5)).toBeGreaterThan(fitDistance(10, 50, 1));
  });
});

describe('fitView', () => {
  it('keeps the viewing direction and centres on the model', () => {
    const v = fitView([100, 0, 0], 10, [100, 0, 5], 50);
    expect(v.target).toEqual([100, 0, 0]);
    expect(v.position[0]).toBeCloseTo(100);
    expect(v.position[2]).toBeCloseTo(fitDistance(10, 50));
  });

  it('falls back to +z when the camera sits on the centre', () => {
    const v = fitView([0, 0, 0], 1, [0, 0, 0], 50);
    expect(v.position[2]).toBeGreaterThan(0);
  });
});

describe('topView', () => {
  it('looks down -y from above the centre', () => {
    const v = topView([60, 15, 0], 80, 50, 2);
    expect(v.target).toEqual([60, 15, 0]);
    expect(v.position[0]).toBe(60);
    expect(v.position[1]).toBeGreaterThan(15 + 80);
    expect(Math.abs(v.position[2])).toBeLessThan(1);
  });
});
