import { describe, it, expect } from 'vitest';
import { nextZoomDistance, zoomLimitsFor, ZOOM_MAX_FACTOR, ZOOM_MIN_FACTOR } from './zoomDistance';

describe('zoomLimitsFor', () => {
  it('scales with the model radius (mm models are not capped at 50)', () => {
    const l = zoomLimitsFor(150);
    expect(l.min).toBeCloseTo(150 * ZOOM_MIN_FACTOR);
    expect(l.max).toBeCloseTo(150 * ZOOM_MAX_FACTOR);
  });

  it('falls back to radius 1 for an empty or broken radius', () => {
    expect(zoomLimitsFor(0)).toEqual(zoomLimitsFor(1));
    expect(zoomLimitsFor(NaN)).toEqual(zoomLimitsFor(1));
  });
});

describe('nextZoomDistance', () => {
  const limits = zoomLimitsFor(150); // 7.5 – 3000

  it('zooms out from a mm-scale start instead of jumping in to 50', () => {
    expect(nextZoomDistance(250, false, 0.3, limits)).toBeCloseTo(325);
  });

  it('zooms in by the factor', () => {
    expect(nextZoomDistance(250, true, 0.3, limits)).toBeCloseTo(175);
  });

  it('stops at the limits', () => {
    expect(nextZoomDistance(8, true, 0.3, limits)).toBeCloseTo(7.5);
    expect(nextZoomDistance(2800, false, 0.3, limits)).toBeCloseTo(3000);
  });

  it('never moves the wrong way when already outside the limits', () => {
    expect(nextZoomDistance(2, true, 0.3, limits)).toBe(2);
    expect(nextZoomDistance(2, false, 0.3, limits)).toBeCloseTo(2.6);
    expect(nextZoomDistance(5000, false, 0.3, limits)).toBe(5000);
    expect(nextZoomDistance(5000, true, 0.3, limits)).toBeCloseTo(3500);
  });
});
