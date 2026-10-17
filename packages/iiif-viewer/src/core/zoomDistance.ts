/**
 * Distance limits for the zoom buttons, scaled to the model.
 *
 * The buttons used to clamp the camera-to-pivot distance to a fixed 0.5–50,
 * which assumes a model a few metres across. A model in millimetres (e.g. a
 * 300 mm toy train opened from ~250 units away) was then pulled to 50 on
 * "zoom out", and a tiny model could never be approached. The limits now follow
 * the model's bounding-sphere radius, whatever its units.
 */

// Closest the buttons go, as a fraction of the model radius.
export const ZOOM_MIN_FACTOR = 0.05;
// Farthest the buttons go, as a multiple of the model radius.
export const ZOOM_MAX_FACTOR = 20;

export interface ZoomLimits {
  min: number;
  max: number;
}

export function zoomLimitsFor(radius: number): ZoomLimits {
  const r = Number.isFinite(radius) && radius > 0 ? radius : 1;
  return { min: r * ZOOM_MIN_FACTOR, max: r * ZOOM_MAX_FACTOR };
}

/**
 * Next camera distance after one press. The clamp only stops movement in the
 * pressed direction: if the camera is already outside the limits (a manifest
 * camera placed very close or far), the press does not jump it the other way.
 */
export function nextZoomDistance(current: number, zoomIn: boolean, factor: number, limits: ZoomLimits): number {
  if (zoomIn) {
    return current <= limits.min ? current : Math.max(limits.min, current * (1 - factor));
  }
  return current >= limits.max ? current : Math.min(limits.max, current * (1 + factor));
}
