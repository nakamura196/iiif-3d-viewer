import { describe, it, expect, vi } from 'vitest';
import { computeFocusCamera, runFocusFlight, FOCUS_DISTANCE_FACTOR, type Vec3 } from './focusCamera';

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

  it('looks outward from the model center when there is no camPos/normal', () => {
    // A point on the far side of a sphere: the old fallback (current viewing
    // direction) put the camera inside the model.
    const target: Vec3 = [0, 0, -1];
    const r = computeFocusCamera({ target, cameraPos: [0, 0, 3], radius: 1, center: [0, 0, 0] });
    expect(r.position[0]).toBeCloseTo(0, 6);
    expect(r.position[2]).toBeCloseTo(-1 - FOCUS_DISTANCE_FACTOR, 6);
    expect(dist(r.position, [0, 0, 0])).toBeGreaterThan(1);
  });

  it('prefers the normal over the outward direction', () => {
    const r = computeFocusCamera({
      target: [0, 0, -1], cameraPos: [0, 0, 3], radius: 1, center: [0, 0, 0], normal: [1, 0, 0],
    });
    expect(r.position[0]).toBeCloseTo(FOCUS_DISTANCE_FACTOR, 6);
  });

  it('falls back to the viewing direction when the point is the center', () => {
    const r = computeFocusCamera({ target: [0, 0, 0], cameraPos: [0, 0, 10], radius: 4, center: [0, 0, 0] });
    expect(r.position[2]).toBeCloseTo(4 * FOCUS_DISTANCE_FACTOR, 6);
  });

  it('never produces NaN when the camera sits on the point with no normal', () => {
    const r = computeFocusCamera({ target: [5, 5, 5], cameraPos: [5, 5, 5], radius: 2 });
    expect(r.position.every((v) => Number.isFinite(v))).toBe(true);
    expect(r.position[2]).toBeCloseTo(5 + 2 * FOCUS_DISTANCE_FACTOR, 6);
  });
});

// A fake gsap whose `to` runs onUpdate then onComplete synchronously, capturing
// the tween targets and the controls.enabled state observed mid-flight.
const makeHarness = () => {
  const tweens: Array<{ target: unknown; vars: Record<string, unknown> }> = [];
  const killed: unknown[] = [];
  let enabledDuringFlight: boolean | undefined;
  const camera = { position: { x: 0, y: 0, z: 0 }, lookAt: vi.fn() };
  const controls = { target: { x: 0, y: 0, z: 0 }, update: vi.fn(), enabled: true };
  const gsap = {
    to: (target: unknown, vars: Record<string, unknown>) => {
      tweens.push({ target, vars });
      if (typeof vars.onUpdate === 'function') {
        enabledDuringFlight = controls.enabled;
        (vars.onUpdate as () => void)();
      }
      if (typeof vars.onComplete === 'function') (vars.onComplete as () => void)();
    },
    killTweensOf: (t: unknown) => killed.push(t),
  };
  return { camera, controls, gsap, tweens, killed, get enabledDuringFlight() { return enabledDuringFlight; } };
};

describe('runFocusFlight', () => {
  it('disables OrbitControls during the flight and re-enables + update()s after', () => {
    const h = makeHarness();
    runFocusFlight({ camera: h.camera, controls: h.controls, gsap: h.gsap }, [1, 2, 3], [4, 5, 6]);
    // The core "can't drag afterward" regression guard:
    expect(h.enabledDuringFlight).toBe(false); // disabled mid-flight
    expect(h.controls.enabled).toBe(true); // restored after
    expect(h.controls.update).toHaveBeenCalled(); // re-synced spherical
  });

  it('kills prior tweens on both the camera and the pivot before starting', () => {
    const h = makeHarness();
    runFocusFlight({ camera: h.camera, controls: h.controls, gsap: h.gsap }, [1, 2, 3], [4, 5, 6]);
    expect(h.killed).toContain(h.camera.position);
    expect(h.killed).toContain(h.controls.target);
  });

  it('tweens the camera to `position` and the pivot to `target`', () => {
    const h = makeHarness();
    runFocusFlight({ camera: h.camera, controls: h.controls, gsap: h.gsap }, [1, 2, 3], [4, 5, 6]);
    const camTween = h.tweens.find((t) => t.target === h.camera.position);
    const pivotTween = h.tweens.find((t) => t.target === h.controls.target);
    expect([camTween?.vars.x, camTween?.vars.y, camTween?.vars.z]).toEqual([1, 2, 3]);
    expect([pivotTween?.vars.x, pivotTween?.vars.y, pivotTween?.vars.z]).toEqual([4, 5, 6]);
    expect(h.camera.lookAt).toHaveBeenCalledWith(4, 5, 6); // keeps looking at the pivot
  });

  it('does not crash and still tweens the camera when controls is null', () => {
    const h = makeHarness();
    expect(() =>
      runFocusFlight({ camera: h.camera, controls: null, gsap: h.gsap }, [1, 2, 3], [4, 5, 6]),
    ).not.toThrow();
    expect(h.tweens.some((t) => t.target === h.camera.position)).toBe(true);
  });
});

describe('runFocusFlight — overlapping flights', () => {
  it('re-enables OrbitControls when a second flight interrupts the first', () => {
    // gsap.killTweensOf() drops the first flight's onComplete, so only the
    // second flight's finish runs. It must restore the pre-flight state
    // (enabled), not the disabled state the first flight left behind.
    const controls = { target: { x: 0, y: 0, z: 0 }, update: vi.fn(), enabled: true };
    const camera = { position: { x: 0, y: 0, z: 0 }, lookAt: vi.fn() };
    const pending: Array<() => void> = [];
    const gsap = {
      to: (_t: unknown, vars: Record<string, unknown>) => {
        if (typeof vars.onComplete === 'function') pending.push(vars.onComplete as () => void);
      },
      killTweensOf: () => { pending.length = 0; },
    };
    runFocusFlight({ camera, controls, gsap }, [1, 2, 3], [4, 5, 6]);
    runFocusFlight({ camera, controls, gsap }, [7, 8, 9], [1, 1, 1]);
    expect(controls.enabled).toBe(false); // still flying
    pending.forEach((f) => f());
    expect(controls.enabled).toBe(true);
  });
});
