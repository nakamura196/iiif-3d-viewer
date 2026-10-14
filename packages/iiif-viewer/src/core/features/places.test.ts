import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { convertToV4 } from '../services/manifestConverter';
import { fitMapView, fromFrame, mapBoundsOf, mapPlacesOf, panBy, project, tilesFor, toFrame, unproject, zoomAround } from './places';

const raw = (name: string) => JSON.parse(readFileSync(new URL(`./__fixtures__/about/${name}.json`, import.meta.url), 'utf8'));
const load = (name: string) => convertToV4(raw(name));

describe('mapPlacesOf: cookbook', () => {
  it('0154 navPlace on the Manifest', () => {
    const places = mapPlacesOf(load('0154-geo-extension'), 'en');
    expect(places).toHaveLength(1);
    expect(places[0].scope).toBe('manifest');
    expect(places[0].label).toBe('The Laocoön Bronze');
    expect(places[0].shapes[0].kind).toBe('point');
  });

  it('0240 navPlace on Canvases: one place per Canvas, with the Canvas to open', () => {
    const m = load('0240-navPlace-on-canvases');
    const ids = (m.items as { id: string }[]).map((c) => c.id);
    const places = mapPlacesOf(m, 'en');
    expect(places.map((p) => p.scope)).toEqual(['canvas', 'canvas']);
    expect(places.map((p) => p.containerId)).toEqual(ids);
    expect(places[0].label).toBe('Current Location of the Laocoön Bronze');
  });

  it('0139 GeoJSON in a tagging Annotation: a polygon tied to a region of the Canvas', () => {
    const m = load('0139-geolocate-canvas-fragment');
    const [p] = mapPlacesOf(m, 'en');
    expect(p.scope).toBe('annotation');
    expect(p.containerId).toBe((m.items![0] as { id: string }).id);
    expect(p.target).toBe('#xywh=920,3600,1510,3000');
    expect(p.shapes[0].kind).toBe('polygon');
    expect(p.bbox[0]).toBeLessThan(p.bbox[2]);
  });

  it('0318 a Collection: the places of its Manifests, with navDate and the Manifest to open', () => {
    const places = mapPlacesOf(raw('0318-collection'), 'en');
    expect(places).toHaveLength(5);
    expect(places.every((p) => p.scope === 'item' && p.resourceType === 'Manifest')).toBe(true);
    expect(places[0].resourceId).toMatch(/manifest-1\.json$/);
    expect(places[0].navDate).toBe('1776-01-01T00:00:00Z');
    expect(places[0].ownerLabel).toBe("Castel Sant'Angelo, Rome");
  });

  it('0318 one of its Manifests', () => {
    const [p] = mapPlacesOf(load('0318-navPlace-navDate'), 'en');
    expect(p.shapes[0]).toEqual({ kind: 'point', coords: [12.4663, 41.9031] });
    expect(p.navDate).toBe('1776-01-01T00:00:00Z');
  });

  it('reads navPlace on Ranges, MultiPolygon and GeometryCollection; drops bad coordinates', () => {
    const places = mapPlacesOf(
      {
        type: 'Manifest',
        items: [{ id: 'c1', type: 'Canvas' }],
        structures: [
          {
            type: 'Range',
            label: { en: ['Part 1'] },
            items: [{ id: 'c1', type: 'Canvas' }],
            navPlace: {
              type: 'Feature',
              geometry: {
                type: 'GeometryCollection',
                geometries: [
                  { type: 'MultiPolygon', coordinates: [[[[0, 0], [1, 0], [1, 1], [0, 0]]]] },
                  { type: 'Point', coordinates: [500, 99] },
                  { type: 'LineString', coordinates: [[2, 2], [3, 3]] },
                ],
              },
            },
          },
        ],
      },
      'en',
    );
    expect(places).toHaveLength(1);
    expect(places[0].scope).toBe('range');
    expect(places[0].containerId).toBe('c1');
    expect(places[0].ownerLabel).toBe('Part 1');
    expect(places[0].shapes.map((s) => s.kind)).toEqual(['polygon', 'line']);
    expect(places[0].bbox).toEqual([0, 0, 3, 3]);
  });

  it('returns nothing for a resource without places', () => {
    expect(mapPlacesOf({ type: 'Manifest', items: [{ id: 'c', type: 'Canvas' }] }, 'en')).toEqual([]);
    expect(mapPlacesOf(null, 'en')).toEqual([]);
    expect(mapBoundsOf([])).toBeUndefined();
  });
});

describe('web mercator', () => {
  it('projects and unprojects', () => {
    expect(project([0, 0])).toEqual([128, 128]);
    const [lng, lat] = unproject(project([12.4663, 41.9031]));
    expect(lng).toBeCloseTo(12.4663, 6);
    expect(lat).toBeCloseTo(41.9031, 6);
  });

  it('fits a box and keeps it in the frame', () => {
    const bbox: [number, number, number, number] = [-118.5, 34.0, 12.5, 41.9];
    const v = fitMapView(bbox, 400, 300, 20);
    for (const p of [[bbox[0], bbox[1]], [bbox[2], bbox[3]]] as [number, number][]) {
      const [x, y] = toFrame(p, v, 400, 300);
      expect(x).toBeGreaterThanOrEqual(19.9);
      expect(x).toBeLessThanOrEqual(380.1);
      expect(y).toBeGreaterThanOrEqual(19.9);
      expect(y).toBeLessThanOrEqual(280.1);
    }
  });

  it('a single point gets the largest fit zoom', () => {
    expect(fitMapView([1, 2, 1, 2], 300, 200).zoom).toBe(14);
  });

  it('zooms around a point and pans', () => {
    const v = { center: [10, 40] as [number, number], zoom: 5 };
    const anchor = fromFrame([50, 60], v, 300, 200);
    const z = zoomAround(v, 1, [50, 60], 300, 200);
    const after = fromFrame([50, 60], z, 300, 200);
    expect(after[0]).toBeCloseTo(anchor[0], 6);
    expect(after[1]).toBeCloseTo(anchor[1], 6);
    const moved = panBy(v, 100, 0);
    expect(toFrame(v.center, moved, 300, 200)[0]).toBeCloseTo(250, 6);
  });

  it('lists the tiles that cover the frame', () => {
    const tiles = tilesFor({ center: [0, 0], zoom: 1 }, 512, 512, 'https://t/{z}/{x}/{y}.png');
    expect(tiles.map((t) => t.url).sort()).toEqual([
      'https://t/1/0/0.png',
      'https://t/1/0/1.png',
      'https://t/1/1/0.png',
      'https://t/1/1/1.png',
    ]);
    expect(tiles.find((t) => t.url.endsWith('/1/0/0.png'))).toMatchObject({ left: 0, top: 0, size: 256 });
  });
});
