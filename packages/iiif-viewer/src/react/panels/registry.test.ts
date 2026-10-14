import { describe, expect, it } from 'vitest';
import { OVERLAYS } from '../overlays/registry';
import { PANEL_IDS } from './registry';

describe('PANELS', () => {
  it('collects the panels from the folder, ordered by order', () => {
    expect(PANEL_IDS).toEqual([
      'metadata',
      'pages',
      'structure',
      'layers',
      'rights',
      'transcript',
      'annotationTranscript',
      'canvasAnnotations',
      'annotations',
      'inference',
    ]);
  });

  it('has no duplicate ids', () => {
    expect(new Set(PANEL_IDS).size).toBe(PANEL_IDS.length);
  });
});

describe('OVERLAYS', () => {
  it('collects the overlays from the folder', () => {
    expect(OVERLAYS.map((o) => o.id)).toEqual(['annotations']);
  });
});
