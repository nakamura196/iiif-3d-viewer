import { describe, it, expect } from 'vitest';
import { computeFocusCamera, FOCUS_DISTANCE_FACTOR, type Vec3 } from './focusCamera';

const dist = (a: Vec3, b: Vec3) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe('computeFocusCamera', () => {
  it('recenters the orbit pivot on the annotation point', () => {
    // The pivot MUST move to the annotation, otherwise the feature drifts to the
    // screen edge (the original bug).
    const r = computeFocusCamera({ target: [1, 2, 3], cameraPos: [0, 0, 10], radius: 5 });
    expect(r.target).toEqual([1, 2, 3]);
  });

  it('does NOT fly onto the point when camPos equals the point (parser fallback)', () => {
    // The manifest parser sets camPos = point when there is no PerspectiveCamera.
    // Treating that as a viewpoint puts the camera on the feature (radius 0) →
    // nothing to see and orbiting does nothing. Must fall back to a real offset.
    const target: Vec3 = [5, 6, 7];
    const r = computeFocusCamera({ target, cameraPos: [0, 0, 20], radius: 4, camPos: [5, 6, 7] });
    expect(dist(r.position, target)).toBeCloseTo(4 * FOCUS_DISTANCE_FACTOR, 6);
    expect(dist(r.position, target)).toBeGreaterThan(0.1);
  });

  it('frames head-on along the annotation normal', () => {
    const target: Vec3 = [0, 0, 0];
    const normal: Vec3 = [0, 0, 1]; // feature faces +Z
    const r = computeFocusCamera({ target, cameraPos: [10, 0, 0], radius: 6, normal });
    // Camera ends up in front of the feature along +Z, not along the old view.
    expect(r.position[0]).toBeCloseTo(0, 6);
    expect(r.position[2]).toBeCloseTo(6 * FOCUS_DISTANCE_FACTOR, 6);
  });

  it('normalizes a non-unit normal before offsetting', () => {
    const r = computeFocusCamera({ target: [0, 0, 0], cameraPos: [1, 1, 1], radius: 10, normal: [0, 5, 0] });
    expect(dist(r.position, [0, 0, 0])).toBeCloseTo(10 * FOCUS_DISTANCE_FACTOR, 6);
    expect(r.position[1]).toBeCloseTo(10 * FOCUS_DISTANCE_FACTOR, 6);
  });

  it('prefers a genuine camPos (distinct from point) over the normal', () => {
    const r = computeFocusCamera({
      target: [1, 1, 1], cameraPos: [9, 9, 9], radius: 5,
      camPos: [-2, 3, 7], normal: [0, 0, 1],
    });
    expect(r.position).toEqual([-2, 3, 7]);
    expect(r.target).toEqual([1, 1, 1]);
  });

  it('falls back to the current viewing direction when no camPos/normal', () => {
    const target: Vec3 = [0, 0, 0];
    const r = computeFocusCamera({ target, cameraPos: [0, 0, 10], radius: 4 });
    expect(r.position[2]).toBeCloseTo(4 * FOCUS_DISTANCE_FACTOR, 6);
    expect(dist(r.position, target)).toBeCloseTo(4 * FOCUS_DISTANCE_FACTOR, 6);
  });

  it('preserves an oblique fallback direction, only changing distance', () => {
    const r = computeFocusCamera({ target: [0, 0, 0], cameraPos: [3, 4, 0], radius: 10 });
    expect(r.position[0] / r.position[1]).toBeCloseTo(3 / 4, 6);
    expect(dist(r.position, [0, 0, 0])).toBeCloseTo(10 * FOCUS_DISTANCE_FACTOR, 6);
  });

  it('never produces NaN when the camera sits on the point with no normal', () => {
    const r = computeFocusCamera({ target: [5, 5, 5], cameraPos: [5, 5, 5], radius: 2 });
    expect(r.position.every((v) => Number.isFinite(v))).toBe(true);
    expect(r.position[2]).toBeCloseTo(5 + 2 * FOCUS_DISTANCE_FACTOR, 6);
  });
});
