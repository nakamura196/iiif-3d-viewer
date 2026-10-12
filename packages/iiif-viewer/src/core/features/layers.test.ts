import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { containersOf } from '../services/containers';
import { canvasImagesOf } from './image';
import {
  imageLayerCount,
  isLayerVisible,
  layerItemsOf,
  layerOpacity,
  moveLayer,
  orderLayers,
  type LayerItem,
} from './layers';

const manifest = (n: string): { items: unknown[] } =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`./__fixtures__/${n}.json`, import.meta.url)), 'utf8'));
const itemsOf = (n: string): LayerItem[] => layerItemsOf(canvasImagesOf(manifest(n).items[0]).paintings);

describe('layerItemsOf', () => {
  it('0036 composition: both images are layers, shown, the miniature on top', () => {
    const items = itemsOf('0036-composition-from-multiple-images');
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.choice)).toEqual([false, false]);
    expect(items.every((i) => isLayerVisible(i, {}))).toBe(true);
    expect(JSON.stringify(items[1].label)).toMatch(/Miniature/);
    expect(items[1].layer.target).toBeDefined();
  });

  it('0326 Choice: every option is a layer, only the first is shown at first', () => {
    const items = itemsOf('0326-annotating-image-layer');
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.choice)).toEqual([true, true]);
    expect(new Set(items.map((i) => i.id)).size).toBe(2);
    expect(items.map((i) => isLayerVisible(i, {}))).toEqual([true, false]);
    expect(isLayerVisible(items[1], { [items[1].id]: { visible: true } })).toBe(true);
  });

  it('a Canvas with one image has one layer', () => {
    expect(itemsOf('0005-image-service')).toHaveLength(1);
  });
});

describe('imageLayerCount (whether the Layers tab is offered)', () => {
  const count = (n: string) => imageLayerCount(containersOf(manifest(n) as never)[0].painting);
  it('counts composed images and Choice options', () => {
    expect(count('0036-composition-from-multiple-images')).toBe(2);
    expect(count('0326-annotating-image-layer')).toBe(2);
    expect(count('0005-image-service')).toBe(1);
  });
});

describe('order and opacity', () => {
  const ids = ['a', 'b', 'c'];
  const items = ids.map((id) => ({ id }) as LayerItem);
  it('moveLayer', () => {
    expect(moveLayer(ids, 'a', 2)).toEqual(['b', 'c', 'a']);
    expect(moveLayer(ids, 'c', 0)).toEqual(['c', 'a', 'b']);
    expect(moveLayer(ids, 'b', 99)).toEqual(['a', 'c', 'b']);
    expect(moveLayer(ids, 'x', 0)).toEqual(ids);
  });
  it('orderLayers keeps items the order does not name', () => {
    expect(orderLayers(items, undefined).map((i) => i.id)).toEqual(ids);
    expect(orderLayers(items, ['c', 'b', 'a']).map((i) => i.id)).toEqual(['c', 'b', 'a']);
    expect(orderLayers(items, ['c', 'a']).map((i) => i.id)).toEqual(['c', 'b', 'a']);
  });
  it('layerOpacity is clamped, 1 by default', () => {
    expect(layerOpacity(items[0], {})).toBe(1);
    expect(layerOpacity(items[0], { a: { opacity: 0.4 } })).toBe(0.4);
    expect(layerOpacity(items[0], { a: { opacity: 3 } })).toBe(1);
  });
});
