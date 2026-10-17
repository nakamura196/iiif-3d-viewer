import { describe, expect, it } from 'vitest';
import { geoFeatureBoxOf, type GeoFeature } from './manifestParser';

// 地点の画像上の範囲（geo.ldas.jp の xywh）。置き場所は 3 通りある
const feature = (extra: Partial<GeoFeature>, xywh?: string): GeoFeature => ({
  '@id': 'https://example.org/places/a',
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [139.76, 35.71] },
  properties: { title: 'A', resourceCoords: [10, 20], ...(xywh === undefined ? {} : { xywh }) },
  ...extra,
});

describe('geoFeatureBoxOf', () => {
  it('reads properties.xywh', () => {
    expect(geoFeatureBoxOf(feature({}, '5936,6344,976,1384'))).toEqual({ x: 5936, y: 6344, w: 976, h: 1384 });
  });

  it('reads metadata.xywh and xywh on the feature (older geo.ldas.jp forms)', () => {
    expect(geoFeatureBoxOf(feature({ metadata: { xywh: '1,2,3,4' } }))).toEqual({ x: 1, y: 2, w: 3, h: 4 });
    expect(geoFeatureBoxOf(feature({ xywh: '5,6,7,8' }))).toEqual({ x: 5, y: 6, w: 7, h: 8 });
  });

  it('prefers properties over metadata', () => {
    expect(geoFeatureBoxOf(feature({ metadata: { xywh: '1,2,3,4' } }, '9,9,9,9'))).toEqual({ x: 9, y: 9, w: 9, h: 9 });
  });

  it('accepts a media-fragment style value', () => {
    expect(geoFeatureBoxOf(feature({}, 'xywh=pixel:1, 2, 3, 4'))).toEqual({ x: 1, y: 2, w: 3, h: 4 });
  });

  it('is null when missing or not a box', () => {
    expect(geoFeatureBoxOf(feature({}))).toBeNull();
    for (const bad of ['', '1,2,3', '1,2,3,x', '1,2,0,4', '1,2,3,-4', 'percent:1,2,3,4', '1,,3,4']) {
      expect(geoFeatureBoxOf(feature({}, bad))).toBeNull();
    }
  });
});
