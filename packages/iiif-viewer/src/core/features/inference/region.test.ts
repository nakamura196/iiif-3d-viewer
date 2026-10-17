import { describe, expect, it } from 'vitest';
import { imageRegionOfBox, regionToCanvasOf, tilesForRegion } from './region';

// An image of 4000 x 2000 pixels painted on a 2000 x 1000 Canvas (2 pixels per Canvas unit).
const target = { x: 0, y: 0, w: 2000, h: 1000 };

describe('imageRegionOfBox', () => {
  it('turns a Canvas box into image pixels', () => {
    expect(imageRegionOfBox({ x: 500, y: 250, w: 1000, h: 500 }, target, 4000, 2000)).toEqual({ x: 1000, y: 500, w: 2000, h: 1000 });
  });

  it('widens to whole pixels and clamps to the image', () => {
    expect(imageRegionOfBox({ x: -10, y: 0.3, w: 100.2, h: 2000 }, target, 4000, 2000)).toEqual({ x: 0, y: 0, w: 181, h: 2000 });
  });

  it('follows the target of the image on the Canvas', () => {
    expect(imageRegionOfBox({ x: 100, y: 100, w: 50, h: 50 }, { x: 100, y: 100, w: 400, h: 200 }, 800, 400)).toEqual({ x: 0, y: 0, w: 100, h: 100 });
  });

  it('is null when the box misses the image', () => {
    expect(imageRegionOfBox({ x: 2100, y: 0, w: 100, h: 100 }, target, 4000, 2000)).toBeNull();
  });
});

describe('regionToCanvasOf', () => {
  it('puts the pixels of the region given to the model back on the Canvas', () => {
    // region 2000 x 1000 pixels shrunk to 1000 x 500 for the model: each model pixel is one Canvas unit
    const map = regionToCanvasOf({ x: 1000, y: 500, w: 2000, h: 1000 }, target, 4000, 2000, 1000, 500);
    expect(map).toEqual({ x: 500, y: 250, scaleX: 1, scaleY: 1 });
  });
});

describe('tilesForRegion', () => {
  const service = { id: 'https://example.org/iiif/a', version: 2 as const };
  const info = { width: 76800, height: 2560, version: 2 as const, level: 0, tiles: [], sizes: [] };
  const scheme = { width: 256, height: 256, scaleFactors: [1, 2, 4, 8, 16, 32, 64, 128, 256] };

  it('takes the coarsest scale factor that still gives the long side', () => {
    // 6000 x 2560 pixels for a long side of 2048: factor 2 (3000 px), not 4 (1500 px)
    const r = tilesForRegion(service, info, scheme, { x: 0, y: 0, w: 6000, h: 2560 }, 2048)!;
    expect(r.scaleFactor).toBe(2);
    expect(r.tiles).toHaveLength(12 * 5);
    expect(r.tiles[0].url).toBe('https://example.org/iiif/a/0,0,512,512/256,/0/default.jpg');
  });

  it('takes the finest factor for a small region', () => {
    expect(tilesForRegion(service, info, scheme, { x: 300, y: 300, w: 100, h: 100 }, 2048)!.scaleFactor).toBe(1);
  });

  it('goes coarser when there would be too many tiles, and gives up past the coarsest', () => {
    expect(tilesForRegion(service, info, scheme, { x: 0, y: 0, w: 6000, h: 2560 }, 2048, 20)!.scaleFactor).toBe(4);
    expect(tilesForRegion(service, info, { ...scheme, scaleFactors: [1, 2] }, { x: 0, y: 0, w: 76800, h: 2560 }, 2048, 20)).toBeNull();
  });
});
