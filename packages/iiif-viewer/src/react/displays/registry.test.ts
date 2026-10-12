import { describe, expect, it } from 'vitest';
import type { ContainerInfo } from '../../core';
import { displayAfter, DISPLAYS } from './registry';

// コンバーターが Scene にした Canvas（回転した画像・Choice・欠けた画像）は painting が空になる。
// Collection の表示は、これに当たっても Collection でなければ後ろの表示に渡す。
describe('表示の振り分け', () => {
  const emptyScene = { id: 'c', kind: 'Scene', label: {}, painting: [], supplementing: [] } as unknown as ContainerInfo;

  it('空の Scene は Collection の表示に当たる', () => {
    expect(DISPLAYS.find((d) => d.match(emptyScene))?.id).toBe('collection');
  });

  it('Collection でなければ、画像の表示（imageCanvas）に渡る', () => {
    expect(displayAfter('collection', emptyScene)?.id).toBe('image-canvas');
  });
});
