/**
 * Pure camera math for the canvas view buttons (全体 / 上).
 *
 * Kept free of three.js so it can be unit-tested. Both take the model's bounding
 * sphere and the camera's vertical field of view, and return where the camera and
 * the orbit pivot (OrbitControls `target`) should end up.
 */
import type { Vec3 } from './focusCamera';

// Extra room around the bounding sphere, as in the initial Bounds fit (margin 1.2).
export const FIT_MARGIN = 1.2;

export interface ViewResult {
  position: Vec3;
  target: Vec3;
}

// Distance at which a sphere of `radius` fits the view, for the narrower of the
// vertical and horizontal field of view.
export function fitDistance(radius: number, fovDeg: number, aspect = 1): number {
  const vfov = (fovDeg * Math.PI) / 180;
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
  const half = Math.min(vfov, hfov) / 2;
  return (Math.max(radius, 1e-6) / Math.sin(half)) * FIT_MARGIN;
}

// 全体: keep the current viewing direction, recenter on the model and back off
// until the whole bounding sphere is in view.
export function fitView(center: Vec3, radius: number, cameraPos: Vec3, fovDeg: number, aspect = 1): ViewResult {
  let dx = cameraPos[0] - center[0];
  let dy = cameraPos[1] - center[1];
  let dz = cameraPos[2] - center[2];
  let l = Math.hypot(dx, dy, dz);
  if (!Number.isFinite(l) || l < 1e-6) {
    dx = 0; dy = 0; dz = 1; l = 1;
  }
  const d = fitDistance(radius, fovDeg, aspect);
  return {
    position: [center[0] + (dx / l) * d, center[1] + (dy / l) * d, center[2] + (dz / l) * d],
    target: [...center],
  };
}

// 上: look straight down the -y axis (y is up in Presentation 4.0). A tiny +z offset
// keeps the view direction off the camera's up vector (lookAt is undefined there)
// and leaves +x pointing right on screen.
export function topView(center: Vec3, radius: number, fovDeg: number, aspect = 1): ViewResult {
  const d = fitDistance(radius, fovDeg, aspect);
  return {
    position: [center[0], center[1] + d, center[2] + d * 1e-4],
    target: [...center],
  };
}
