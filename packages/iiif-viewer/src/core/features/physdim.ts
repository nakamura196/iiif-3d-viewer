// physdim: 実寸の物差し（IIIF Physical Dimensions service）の読み取り（React に依存しない）。
// この機能の担当だけがこのファイルを書く。
//
// Canvas の service に physdim（1 ピクセルが実物で何 mm か）が書いてあれば、それを読む。
// 目盛りの間隔と位置の計算もここ。画面への描画は react/displays/PhysicalRuler.tsx が行う。
// 元は mirador-physical-ruler（nakamura196）の PhysicalRuler.jsx。

type Json = Record<string, unknown>;

const asList = (v: unknown): unknown[] => (Array.isArray(v) ? v : v == null ? [] : [v]);
const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);

export const PHYSDIM_PROFILE = 'http://iiif.io/api/annex/services/physdim';

export type SourceUnit = 'mm' | 'cm' | 'in';
export type DisplayUnit = 'mm' | 'cm' | 'in';

export interface Physdim {
  /** Physical units per Canvas pixel. */
  scale: number;
  units: SourceUnit;
}

const isPhysdim = (svc: Json): boolean => {
  const marks = [...asList(svc.profile), svc['@context'], ...asList(svc['@context']), svc.type, svc['@type']];
  return marks.some((m) => typeof m === 'string' && (m === PHYSDIM_PROFILE || m.includes('physdim')));
};

const unitOf = (v: unknown): SourceUnit | undefined => {
  const u = typeof v === 'string' ? v.trim().toLowerCase() : '';
  if (u === 'mm' || u === 'cm') return u;
  if (u === 'in' || u === 'inch' || u === 'inches') return 'in';
  return undefined;
};

/** The physdim service of a Canvas (Presentation 2 and 3), or undefined. */
export const physdimOf = (canvas: unknown): Physdim | undefined => {
  if (!isObj(canvas)) return undefined;
  for (const svc of [...asList(canvas.service), ...asList(canvas.services)]) {
    if (!isObj(svc) || !isPhysdim(svc)) continue;
    const scale = Number(svc.physicalScale ?? svc.physical_scale);
    const units = unitOf(svc.physicalUnits ?? svc.physical_units);
    if (Number.isFinite(scale) && scale > 0 && units) return { scale, units };
  }
  return undefined;
};

const MM: Record<SourceUnit, number> = { mm: 1, cm: 10, in: 25.4 };

/** How many `to` units one `from` unit is. */
export const unitFactor = (from: SourceUnit, to: DisplayUnit): number => MM[from] / MM[to];

/** A round step (1, 2, 5 × 10^n) that is about `targetPx` wide on screen. */
export const niceInterval = (pixelsPerUnit: number, targetPx = 80): number => {
  if (!(pixelsPerUnit > 0)) return 0;
  const raw = targetPx / pixelsPerUnit;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const n = raw / magnitude;
  return (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * magnitude;
};

export interface Tick {
  /** Position along the Canvas, in the display unit. */
  pos: number;
  /** Position on screen along the ruler, in CSS pixels. */
  px: number;
  /** Ticks that get a label. */
  major: boolean;
  label: string;
}

/**
 * Ticks along one axis.
 * @param physicalLength  length of the Canvas on that axis, in the display unit
 * @param pixelsPerUnit   screen pixels per display unit
 * @param originPx        screen position of the Canvas edge (may be off screen)
 * @param viewPx          length of the visible axis in CSS pixels
 * @param startPx         ticks nearer than this to the origin of the axis are hidden (the corner box)
 */
export function buildTicks(physicalLength: number, pixelsPerUnit: number, originPx: number, viewPx: number, startPx = 0) {
  const interval = niceInterval(pixelsPerUnit);
  const ticks: Tick[] = [];
  if (!(interval > 0) || !(physicalLength > 0)) return { ticks, interval };
  const stepPx = interval * pixelsPerUnit;
  const labelEvery = stepPx >= 50 ? 1 : stepPx >= 25 ? 2 : 5;
  const decimals = Math.min(3, Math.max(0, Math.ceil(-Math.log10(interval) - 1e-9)));
  const first = Math.max(0, Math.ceil((startPx - originPx) / pixelsPerUnit / interval));
  const last = Math.min(Math.floor(physicalLength / interval + 1e-9), Math.floor((viewPx - originPx) / pixelsPerUnit / interval));
  for (let k = first; k <= last; k++) {
    const pos = k * interval;
    ticks.push({ pos, px: originPx + pos * pixelsPerUnit, major: k % labelEvery === 0, label: pos.toFixed(decimals) });
  }
  return { ticks, interval };
}

export interface RulerGeometry {
  /** Screen pixels per display unit. */
  pixelsPerUnit: number;
  /** Screen position of the Canvas top left, in the box. */
  originX: number;
  originY: number;
  /** Canvas size in the display unit. */
  lengthX: number;
  lengthY: number;
}

/** View of an ImageView stage (the Canvas fitted to stageW × stageH, then moved and zoomed) as ruler numbers. */
export function rulerGeometry(
  physdim: Physdim,
  unit: DisplayUnit,
  canvas: { w: number; h: number },
  stage: { scale: number; tx: number; ty: number; stageW: number; stageH: number; boxW: number; boxH: number },
): RulerGeometry {
  const f = unitFactor(physdim.units, unit);
  const screenW = stage.stageW * stage.scale; // the Canvas width on screen
  const screenH = stage.stageH * stage.scale;
  return {
    pixelsPerUnit: screenW / (canvas.w * physdim.scale * f),
    originX: stage.boxW / 2 + stage.tx - screenW / 2,
    originY: stage.boxH / 2 + stage.ty - screenH / 2,
    lengthX: canvas.w * physdim.scale * f,
    lengthY: canvas.h * physdim.scale * f,
  };
}
