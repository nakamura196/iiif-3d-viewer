import { describe, expect, it } from 'vitest';
import {
  applyGeorefPatch,
  imageViewParams,
  imageViewToStage,
  mapViewParams,
  readGeorefParams,
  rewriteOldGeoHost,
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
