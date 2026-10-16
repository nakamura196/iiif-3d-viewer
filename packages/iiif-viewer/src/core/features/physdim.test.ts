import { describe, expect, it } from 'vitest';
import { buildTicks, niceInterval, physdimOf, rulerGeometry, unitFactor } from './physdim';

const svc = { '@context': 'http://iiif.io/api/annex/services/physdim/1/context.json', profile: 'http://iiif.io/api/annex/services/physdim', physicalScale: 0.09993, physicalUnits: 'mm' };

describe('physdimOf', () => {
  it('reads a service array (Presentation 3)', () => {
    expect(physdimOf({ service: [svc] })).toEqual({ scale: 0.09993, units: 'mm' });
  });
  it('reads a single service object and a profile array (Presentation 2)', () => {
    const v2 = { '@context': 'x', profile: ['http://iiif.io/api/annex/services/physdim'], physicalScale: '0.5', physicalUnits: 'in' };
    expect(physdimOf({ service: v2 })).toEqual({ scale: 0.5, units: 'in' });
  });
  it('accepts a physdim @context without a profile', () => {
    expect(physdimOf({ service: [{ '@context': 'http://iiif.io/api/annex/services/physdim/1/context.json', physicalScale: 1, physicalUnits: 'cm' }] })).toEqual({ scale: 1, units: 'cm' });
  });
  it('ignores other services and bad values', () => {
    expect(physdimOf({ service: [{ profile: 'level2' }] })).toBeUndefined();
    expect(physdimOf({ service: [{ ...svc, physicalScale: 0 }] })).toBeUndefined();
    expect(physdimOf({ service: [{ ...svc, physicalUnits: 'furlong' }] })).toBeUndefined();
    expect(physdimOf(undefined)).toBeUndefined();
  });
});

describe('niceInterval', () => {
  it('picks 1, 2, 5 × 10^n near 80 px', () => {
    expect(niceInterval(8)).toBe(10); // raw 10
    expect(niceInterval(1)).toBe(100); // raw 80 -> 10 * 10
    expect(niceInterval(40)).toBe(2); // raw 2
    expect(niceInterval(20)).toBe(5); // raw 4
    expect(niceInterval(800)).toBe(0.1); // raw 0.1
  });
  it('returns 0 for a bad scale', () => {
    expect(niceInterval(0)).toBe(0);
    expect(niceInterval(NaN)).toBe(0);
  });
});

describe('unitFactor', () => {
  it('converts between mm, cm and in', () => {
    expect(unitFactor('mm', 'cm')).toBeCloseTo(0.1);
    expect(unitFactor('in', 'mm')).toBeCloseTo(25.4);
    expect(unitFactor('cm', 'in')).toBeCloseTo(10 / 25.4);
  });
});

describe('buildTicks', () => {
  it('places ticks on screen and labels every one at wide spacing', () => {
    // 10 px per unit: interval 10 (100 px apart), origin at 50 px
    const { ticks, interval } = buildTicks(1000, 10, 50, 400);
    expect(interval).toBe(10);
    expect(ticks.map((t) => t.px)).toEqual([50, 150, 250, 350]);
    expect(ticks.every((t) => t.major)).toBe(true);
    expect(ticks[1].label).toBe('10');
  });
  it('skips ticks hidden by the corner box and before the Canvas edge', () => {
    const { ticks } = buildTicks(1000, 10, -120, 400, 30);
    expect(ticks[0].pos).toBe(20); // 20 -> px 80; 10 -> px -20 hidden
  });
  it('stops at the end of the Canvas', () => {
    const { ticks } = buildTicks(25, 10, 0, 1000);
    expect(ticks.map((t) => t.pos)).toEqual([0, 10, 20]);
  });
  it('uses fewer decimals for round steps and more for fine ones', () => {
    expect(buildTicks(10000, 0.3, 0, 500).ticks[1].label).toBe('200');
    expect(buildTicks(10000, 1000, 0, 500).ticks[1].label).toBe('0.1');
    expect(buildTicks(10000, 2000, 0, 500).ticks[1].label).toBe('0.05');
  });
});

describe('rulerGeometry', () => {
  const stage = { scale: 2, tx: 10, ty: -20, stageW: 500, stageH: 250, boxW: 800, boxH: 600 };
  it('computes pixels per unit from the zoom', () => {
    const g = rulerGeometry({ scale: 0.1, units: 'mm' }, 'mm', { w: 1000, h: 500 }, stage);
    expect(g.pixelsPerUnit).toBeCloseTo(10); // 1000 screen px for 100 mm
    expect(g.lengthX).toBeCloseTo(100);
    expect(g.lengthY).toBeCloseTo(50);
  });
  it('puts the Canvas corner where the stage transform puts it', () => {
    const g = rulerGeometry({ scale: 0.1, units: 'mm' }, 'mm', { w: 1000, h: 500 }, stage);
    expect(g.originX).toBeCloseTo(800 / 2 + 10 - 500);
    expect(g.originY).toBeCloseTo(600 / 2 - 20 - 250);
  });
  it('changes with the display unit', () => {
    const g = rulerGeometry({ scale: 0.1, units: 'mm' }, 'cm', { w: 1000, h: 500 }, stage);
    expect(g.pixelsPerUnit).toBeCloseTo(100);
  });
});
