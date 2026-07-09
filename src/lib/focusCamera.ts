/**
 * Pure camera-framing math for "focus on an annotation".
 *
 * Kept free of three.js / gsap so it can be unit-tested. Given where the camera
 * is now and the annotation point, it returns where the camera and the orbit
 * pivot (OrbitControls `target`) should end up:
 *
 *   - target  → the annotation point (so the feature ends up centered; without
 *     moving the pivot the feature drifts to the screen edge).
 *   - position → chosen in priority order:
 *       1. an explicit `camPos` DISTINCT from the point (a real recommended
 *          viewpoint). NOTE: the manifest parser falls back to camPos = point
 *          when no PerspectiveCamera exists, so a camPos equal to the point is
 *          NOT a viewpoint — flying there lands the camera on the feature
 *          (zero orbit radius → nothing to look at, orbiting does nothing).
 *       2. the annotation `normal` (Voyager `direction`): place the camera in
 *          front of the feature, along its outward normal → head-on framing.
 *       3. heuristic: keep the current viewing direction, pull in to a framing
 *          distance derived from the model radius.
 */
export type Vec3 = [number, number, number];

// Fraction of the model's bounding radius used as the focus distance. <1 pulls
// the camera closer than the model's extent so the feature isn't tiny, while
// staying outside the surface for typical convex-ish scans.
export const FOCUS_DISTANCE_FACTOR = 0.9;

export interface FocusInput {
  /** Annotation point (selector.value), world space. */
  target: Vec3;
  /** Current camera position, world space. */
  cameraPos: Vec3;
  /** Model bounding-sphere radius (framing-distance basis). */
  radius: number;
  /** Optional manifest camera position — used only if distinct from `target`. */
  camPos?: Vec3 | null;
  /** Optional annotation outward normal (Voyager `direction`) for head-on view. */
  normal?: Vec3 | null;
}

export interface FocusResult {
  position: Vec3;
  target: Vec3;
}

const finiteVec = (v: Vec3 | null | undefined): v is Vec3 =>
  Array.isArray(v) && v.length >= 3 && v.every((n) => Number.isFinite(n));

const len = (x: number, y: number, z: number) => Math.hypot(x, y, z);

export function computeFocusCamera(input: FocusInput): FocusResult {
  const { target, cameraPos, radius, camPos, normal } = input;
  const dist = Math.max(radius, 1e-6) * FOCUS_DISTANCE_FACTOR;
  const at: Vec3 = [...target];

  // 1. A real recommended viewpoint (distinct from the point).
  if (finiteVec(camPos)) {
    const d = len(camPos[0] - target[0], camPos[1] - target[1], camPos[2] - target[2]);
    if (d > 1e-6) return { position: [camPos[0], camPos[1], camPos[2]], target: at };
  }

  // 2. Head-on along the annotation normal.
  if (finiteVec(normal)) {
    const nl = len(normal[0], normal[1], normal[2]);
    if (nl > 1e-6) {
      return {
        position: [
          target[0] + (normal[0] / nl) * dist,
          target[1] + (normal[1] / nl) * dist,
          target[2] + (normal[2] / nl) * dist,
        ],
        target: at,
      };
    }
  }

  // 3. Keep the current viewing direction; recenter + adjust distance.
  let dx = cameraPos[0] - target[0];
  let dy = cameraPos[1] - target[1];
  let dz = cameraPos[2] - target[2];
  let l = len(dx, dy, dz);
  if (!Number.isFinite(l) || l < 1e-6) {
    dx = 0; dy = 0; dz = 1; l = 1;
  }
  return {
    position: [target[0] + (dx / l) * dist, target[1] + (dy / l) * dist, target[2] + (dz / l) * dist],
    target: at,
  };
}
