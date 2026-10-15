import { describe, expect, it } from 'vitest';
import { manifestFromImageInfo } from './imageInfoManifest';
import { isImageInfoJson } from '../features/compareSources';

const URL3 = 'https://example.org/iiif/3/page1/info.json';
const info3 = {
  '@context': 'http://iiif.io/api/image/3/context.json',
  id: 'https://example.org/iiif/3/page1',
  type: 'ImageService3',
  protocol: 'http://iiif.io/api/image',
  profile: 'level1',
  width: 4000,
  height: 3000,
  service: [{ id: 'https://example.org/auth/probe/page1', type: 'AuthProbeService2' }],
};
const info2 = {
  '@context': 'http://iiif.io/api/image/2/context.json',
  '@id': 'https://example.org/iiif/2/page%201',
  protocol: 'http://iiif.io/api/image',
  profile: ['http://iiif.io/api/image/2/level2.json'],
  width: 800,
  height: 600,
};

const bodyOf = (m: any) => m.items[0].items[0].items[0].body;

describe('manifestFromImageInfo', () => {
  it('is detected as an info.json', () => {
    expect(isImageInfoJson(info3)).toBe(true);
    expect(isImageInfoJson(info2)).toBe(true);
  });

  it('paints the whole Image API 3 image on one Canvas and keeps the auth services', () => {
    const m: any = manifestFromImageInfo(info3, URL3);
    expect(m.type).toBe('Manifest');
    expect(m.label).toEqual({ none: ['page1'] });
    expect(m.items).toHaveLength(1);
    expect(m.items[0]).toMatchObject({ type: 'Canvas', width: 4000, height: 3000 });
    const body = bodyOf(m);
    expect(body.id).toBe('https://example.org/iiif/3/page1/full/max/0/default.jpg');
    expect(body.service[0]).toMatchObject({ id: info3.id, type: 'ImageService3', profile: 'level1' });
    expect(body.service[0].service).toEqual(info3.service);
  });

  it('uses the Image API 2 form for a 2.x info.json', () => {
    const m: any = manifestFromImageInfo(info2, 'https://example.org/iiif/2/page%201/info.json');
    expect(m.label).toEqual({ none: ['page 1'] });
    const body = bodyOf(m);
    expect(body.id).toBe('https://example.org/iiif/2/page%201/full/full/0/default.jpg');
    expect(body.service[0]).toMatchObject({ '@id': info2['@id'], '@type': 'ImageService2' });
  });

  it('returns null for something without a size', () => {
    expect(manifestFromImageInfo({ '@context': 'http://iiif.io/api/image/3/context.json' }, URL3)).toBeNull();
  });
});
