import { describe, expect, it } from 'vitest';
import {
  applyGeorefPatch,
  autoRotateOnSelectParams,
  imageViewParams,
  imageViewToStage,
  localNorthUpRotation,
  mapViewParams,
  normalizeAngle,
  northUpRotation,
  readGeorefParams,
  rewriteOldGeoHost,
  rotationParams,
  stageToImageView,
} from './georefView';

const read = (q: string, other: string | null = null) => readGeorefParams(new URLSearchParams(q), other);

describe('readGeorefParams', () => {
  it('reads a geo.ldas.jp link as it is', () => {
    const s = read('u=https://geo.ldas.jp/manifest.json&mapZoom=12.5&mapLat=35.68&mapLng=139.76&zoom=2.5&centerX=0.4&centerY=0.3&id=p1');
    expect(s).toEqual({
      manifest: 'https://geo.ldas.jp/manifest.json',
      map: { zoom: 12.5, lat: 35.68, lng: 139.76 },
      image: { zoom: 2.5, centerX: 0.4, centerY: 0.3 },
      id: 'p1',
    });
  });

  it('prefers iiif-content (or manifest) over u', () => {
    expect(read('u=https://a/m.json', 'https://b/m.json').manifest).toBe('https://b/m.json');
  });

  it('rewrites the old github.io address of u', () => {
    expect(read('u=https://nakamura196.github.io/iiif_geo/canvas.json').manifest).toBe('https://geo.ldas.jp/canvas.json');
    expect(rewriteOldGeoHost('https://example.org/m.json')).toBe('https://example.org/m.json');
  });

  it('centres on lat/lng, with zoom 15 unless mapZoom is given', () => {
    expect(read('lat=35&lng=135')).toMatchObject({ focus: { lat: 35, lng: 135 }, map: { zoom: 15, lat: 35, lng: 135 } });
    expect(read('lat=35&lng=135&mapZoom=9').map?.zoom).toBe(9);
  });

  it('keeps a moved map centre over lat/lng (lat/lng stays in the URL)', () => {
    expect(read('lat=35&lng=135&mapZoom=12&mapLat=1&mapLng=2')).toMatchObject({ focus: { lat: 35, lng: 135 }, map: { zoom: 12, lat: 1, lng: 2 } });
  });

  it('ignores half-given or broken values', () => {
    const s = read('mapLat=35&mapZoom=abc&zoom=2&centerX=0.5&lat=&lng=1');
    expect(s.map).toBeUndefined();
    expect(s.image).toBeUndefined();
    expect(s.focus).toBeUndefined();
  });

  it('does not use the image zoom for the map', () => {
    expect(read('zoom=3&centerX=0.5&centerY=0.5').map).toBeUndefined();
  });
});

describe('writing', () => {
  it('formats like geo.ldas.jp', () => {
    expect(mapViewParams({ zoom: 12.3456, lat: 35.123456789, lng: 139.1 })).toEqual({ mapZoom: '12.35', mapLat: '35.123457', mapLng: '139.100000' });
    expect(imageViewParams({ zoom: 1, centerX: 0.5, centerY: 0.712345 })).toEqual({ zoom: '1.00', centerX: '0.5000', centerY: '0.7123' });
  });

  it('keeps the other parameters and removes nulls', () => {
    expect(applyGeorefPatch('u=x&id=a&rotation=10', { id: null, mapZoom: '3' })).toBe('u=x&rotation=10&mapZoom=3');
  });
});

describe('image view conversion', () => {
  // A 2000 x 1000 Canvas in an 800 x 600 box: fitted to 800 x 400.
  const stage = { stageW: 800, stageH: 400, boxW: 800 };

  it('the fitted view is zoom 1, centred', () => {
    expect(stageToImageView({ scale: 1, tx: 0, ty: 0 }, stage, 2000, 1000)).toEqual({ zoom: 1, centerX: 0.5, centerY: 0.25 });
  });

  it('a tall Canvas fitted by height has zoom below 1', () => {
    // 1000 x 2000 in 800 x 600: fitted to 300 x 600
    const v = stageToImageView({ scale: 1, tx: 0, ty: 0 }, { stageW: 300, stageH: 600, boxW: 800 }, 1000, 2000);
    expect(v.zoom).toBeCloseTo(0.375);
    expect(v.centerY).toBeCloseTo(1);
  });

  it('round-trips', () => {
    const view = { scale: 3.2, tx: -150, ty: 80 };
    const back = imageViewToStage(stageToImageView(view, stage, 2000, 1000), stage, 2000, 1000);
    expect(back.scale).toBeCloseTo(view.scale);
    expect(back.tx).toBeCloseTo(view.tx);
    expect(back.ty).toBeCloseTo(view.ty);
  });

  it('puts the given point at the middle of the box', () => {
    // centre on Canvas (1500, 250) = viewport (0.75, 0.125), zoom 2
    const v = imageViewToStage({ zoom: 2, centerX: 0.75, centerY: 0.125 }, stage, 2000, 1000);
    expect(v.scale).toBe(2);
    // the point sits at stage offset (0.25 * 800, -0.25 * 400) from the stage centre; scaled and shifted to 0
    expect(v.tx + v.scale * 0.25 * 800).toBeCloseTo(0);
    expect(v.ty + v.scale * -0.25 * 400).toBeCloseTo(0);
  });
});

describe('rotation', () => {
  it('reads rotation, folded into (-180, 180]', () => {
    expect(read('rotation=12.5').rotation).toBe(12.5);
    expect(read('rotation=270').rotation).toBe(-90);
    expect(read('rotation=abc').rotation).toBeUndefined();
    expect(read('').rotation).toBeUndefined();
  });

  it('writes rotation to 0.1 degree', () => {
    expect(rotationParams(33.333)).toEqual({ rotation: '33.3' });
    expect(rotationParams(-180)).toEqual({ rotation: '180' });
    expect(normalizeAngle(-540)).toBe(180);
  });

  it('round-trips a turned view', () => {
    const stage = { stageW: 800, stageH: 400, boxW: 800 };
    const view = { scale: 2.5, tx: -120, ty: 60, rotation: 30 };
    const iv = stageToImageView(view, stage, 2000, 1000);
    const back = imageViewToStage(iv, stage, 2000, 1000, 30);
    expect(back.scale).toBeCloseTo(view.scale);
    expect(back.tx).toBeCloseTo(view.tx);
    expect(back.ty).toBeCloseTo(view.ty);
  });

  it('keeps the centre when the view is turned about the box centre', () => {
    // turning about the box centre turns t by the same angle; the image point at the centre stays
    const stage = { stageW: 800, stageH: 400, boxW: 800 };
    const a = stageToImageView({ scale: 2, tx: -100, ty: 40 }, stage, 2000, 1000);
    const r = (90 * Math.PI) / 180;
    const b = stageToImageView(
      { scale: 2, tx: -100 * Math.cos(r) - 40 * Math.sin(r), ty: -100 * Math.sin(r) + 40 * Math.cos(r), rotation: 90 },
      stage,
      2000,
      1000,
    );
    expect(b.centerX).toBeCloseTo(a.centerX);
    expect(b.centerY).toBeCloseTo(a.centerY);
  });
});

describe('northUpRotation', () => {
  // image (x right, y down) and the place (lng, lat)
  const pt = (x: number, y: number, lng: number, lat: number) => ({ x, y, lng, lat });

  it('needs two points', () => {
    expect(northUpRotation([])).toBeNull();
    expect(northUpRotation([pt(0, 0, 139, 35)])).toBeNull();
    expect(northUpRotation([pt(0, 0, 139, 35), pt(0, 0, 139, 35)])).toBeNull();
  });

  it('is 0 when the image is already north up', () => {
    expect(northUpRotation([pt(0, 0, 0, 0), pt(100, 0, 1, 0), pt(0, 100, 0, -1)])).toBeCloseTo(0);
  });

  it('turns 90° counter-clockwise when the right of the image is north', () => {
    // geo.ldas.jp's two-point formula returned 0 here; the least-squares one is right
    expect(northUpRotation([pt(0, 0, 139, 35), pt(100, 0, 139, 36)])).toBeCloseTo(90);
  });

  it('turns 90° clockwise when the left of the image is north', () => {
    // right of the image = south, down = west
    expect(northUpRotation([pt(0, 0, 0, 0), pt(100, 0, 0, -1), pt(0, 100, -1, 0)])).toBeCloseTo(-90);
  });

  it('turns 180° when the image is upside down', () => {
    expect(Math.abs(northUpRotation([pt(0, 0, 0, 0), pt(100, 100, -1, 1)])!)).toBeCloseTo(180);
  });

  it('allows for the narrower degrees of longitude', () => {
    // at 60°N two degrees of longitude are as long as one of latitude: 100 px right = 2° east, 100 px up = 1° north
    const r = northUpRotation([pt(0, 0, 10, 60), pt(100, 0, 12, 60), pt(0, -100, 10, 61)]);
    expect(r).toBeCloseTo(0, 0); // the mean latitude is 60.3°, not quite 60°
  });

  it('ignores points that are not numbers', () => {
    expect(northUpRotation([pt(0, 0, 139, 35), pt(100, 0, 139, 36), pt(NaN, 0, 1, 1)])).toBeCloseTo(90);
  });
});

describe('autoRotateOnSelect', () => {
  it('is on only when the link says true', () => {
    expect(read('autoRotateOnSelect=true').autoRotateOnSelect).toBe(true);
    expect(read('autoRotateOnSelect=false').autoRotateOnSelect).toBeUndefined();
    expect(read('').autoRotateOnSelect).toBeUndefined();
  });

  it('writes true, and removes the parameter when off', () => {
    expect(autoRotateOnSelectParams(true)).toEqual({ autoRotateOnSelect: 'true' });
    expect(applyGeorefPatch('u=x&autoRotateOnSelect=true', autoRotateOnSelectParams(false))).toBe('u=x');
  });
});

describe('localNorthUpRotation', () => {
  const pt = (x: number, y: number, lng: number, lat: number) => ({ x, y, lng, lat });
  // the left half of the picture is north up; the right half is drawn turned 90° (its right is north)
  const pairs = [
    pt(0, 0, 0, 0),
    pt(100, 0, 1, 0),
    pt(0, 100, 0, -1),
    pt(1000, 0, 10, 0),
    pt(1100, 0, 10, 1),
    pt(1000, 100, 11, 0),
  ];

  it('follows the three points nearest the chosen one', () => {
    expect(localNorthUpRotation(pairs, 0)).toBeCloseTo(0);
    expect(localNorthUpRotation(pairs, 4)).toBeCloseTo(90);
  });

  it('uses the two there are when there are only two', () => {
    expect(localNorthUpRotation([pt(0, 0, 139, 35), pt(100, 0, 139, 36)], 1)).toBeCloseTo(90);
  });

  it('is null for a lone point or a point that is not there', () => {
    expect(localNorthUpRotation([pt(0, 0, 139, 35)], 0)).toBeNull();
    expect(localNorthUpRotation(pairs, 99)).toBeNull();
    expect(localNorthUpRotation([pt(NaN, 0, 1, 1), ...pairs], 0)).toBeNull();
  });
});
