import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { convertToV4 } from '../services/manifestConverter';
import {
  openingStep,
  readingTime,
  scrollOf,
  splitHeading,
  stepAt,
  stepTarget,
  stepText,
  storyBodies,
  storyOf,
  type Story,
  type StoryStep,
} from './story';

// 倭寇図巻のストーリー（https://www.hi.u-tokyo.ac.jp/collection/digitalgallery/wakozukan/data/cp/story/m.json）の
// 先頭 7 件（章 3、細部 4）。2026-10-14 に保存。章と細部の区別は本文先頭の <h2> だけで書かれている。
const fixture = (name: string) =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`./__fixtures__/${name}`, import.meta.url)), 'utf8'));
const CANVAS = 'https://www.hi.u-tokyo.ac.jp/collection/digitalgallery/wakozukan/data/iiif/wakozukan/canvas/p1';

const manifest = (annotations: unknown[], extra: Record<string, unknown> = {}) =>
  convertToV4({
    '@context': 'http://iiif.io/api/presentation/3/context.json',
    id: 'https://example.org/m',
    type: 'Manifest',
    label: { en: ['m'] },
    items: [
      {
        id: 'https://example.org/c1',
        type: 'Canvas',
        width: 1000,
        height: 500,
        items: [
          {
            id: 'https://example.org/c1/p',
            type: 'AnnotationPage',
            items: [
              {
                id: 'https://example.org/c1/p/i',
                type: 'Annotation',
                motivation: 'painting',
                body: { id: 'https://example.org/i.jpg', type: 'Image', format: 'image/jpeg', width: 1000, height: 500 },
                target: 'https://example.org/c1',
              },
            ],
          },
        ],
        annotations: [{ id: 'https://example.org/c1/a', type: 'AnnotationPage', items: annotations }],
      },
    ],
    ...extra,
  });

const note = (n: number, body: unknown, xywh = `${n * 100},0,100,100`) => ({
  id: `https://example.org/a${n}`,
  type: 'Annotation',
  motivation: 'describing',
  body,
  target: `https://example.org/c1#xywh=${xywh}`,
});
const html = (value: string, language?: string) => ({ type: 'TextualBody', format: 'text/html', value, ...(language ? { language } : {}) });

describe('storyOf', () => {
  it('reads the Wako zukan story: steps in order, chapters from the <h2> headings', () => {
    const story = storyOf(convertToV4(fixture('wakozukan-story.json')), 'ja');
    expect(story?.steps.map((s) => s.id.split('/').pop())).toEqual(['m4', 'm5', 'm6', 'm7', 'm9', 'm10', 'm15']);
    expect(story?.steps[0].canvasId).toBe(CANVAS);
    expect(story?.chapters.map((c) => [c.label, c.steps])).toEqual([
      ['（１）倭寇船の登場', [0, 1, 2, 3]],
      ['（２）倭寇の上陸', [4, 5]],
      ['（３）形勢観望', [6]],
    ]);
    expect(story?.chapters[0].headStep).toBe(0);
    expect(stepTarget(story!.steps[1])).toEqual({ canvasId: CANVAS, xywh: [88931, 868, 366, 308] });
  });

  it('is null for fewer than two steps or when nothing points into the picture', () => {
    expect(storyOf(manifest([note(1, html('<p>a</p>'))]))).toBeNull();
    expect(
      storyOf(manifest([1, 2].map((n) => ({ ...note(n, html('<p>x</p>')), target: 'https://example.org/c1' })))),
    ).toBeNull();
  });

  it('leaves out tagging and painting, and keeps commenting', () => {
    const m = manifest([
      note(1, html('<p>a</p>')),
      { ...note(2, { type: 'TextualBody', value: 'tag' }), motivation: 'tagging' },
      { ...note(3, { type: 'TextualBody', value: 'c' }), motivation: 'commenting' },
    ]);
    expect(storyOf(m)?.steps.map((s) => s.id)).toEqual(['https://example.org/a1', 'https://example.org/a3']);
  });

  it('does not group when every step has a heading (a Digirati Exhibition tour)', () => {
    const m = manifest([note(1, html('<h2>One</h2><p>a</p>')), note(2, html('<h2>Two</h2><p>b</p>'))]);
    expect(storyOf(m)?.chapters).toEqual([]);
  });

  it('takes chapters from Ranges: the same region, else the smallest region that holds the step', () => {
    const m = manifest(
      [note(1, html('<p>a</p>'), '0,0,500,500'), note(2, html('<p>b</p>'), '100,100,50,50'), note(3, html('<p>c</p>'), '700,100,50,50')],
      {
        structures: [
          {
            id: 'https://example.org/r',
            type: 'Range',
            label: { en: ['Contents'] },
            items: [
              { id: 'https://example.org/r1', type: 'Range', label: { en: ['Left'] }, items: [{ id: 'https://example.org/c1#xywh=0,0,500,500', type: 'Canvas' }] },
              { id: 'https://example.org/r2', type: 'Range', label: { en: ['Right'] }, items: [{ id: 'https://example.org/c1#xywh=500,0,500,500', type: 'Canvas' }] },
            ],
          },
        ],
      },
    );
    expect(storyOf(m)?.chapters.map((c) => [c.id, c.steps])).toEqual([
      ['https://example.org/r1', [0, 1]],
      ['https://example.org/r2', [2]],
    ]);
  });
});

describe('step text', () => {
  const step = (bodies: StoryStep['bodies']): StoryStep => ({ id: 'a', canvasId: 'c', region: { type: 'canvas' }, bodies });

  it('splits a leading heading off', () => {
    expect(splitHeading('\n <h2 class="x">（１）倭寇船&amp;の登場</h2><p>本文</p>')).toEqual({ heading: '（１）倭寇船&の登場', rest: '<p>本文</p>' });
    expect(splitHeading('<p>x</p><h2>late</h2>')).toEqual({ rest: '<p>x</p><h2>late</h2>' });
  });

  it('drops a body that held only the heading', () => {
    const t = stepText(step([{ kind: 'text', format: 'text/html', value: '<h2>Only</h2>' }]), 'en');
    expect(t).toEqual({ heading: 'Only', bodies: [] });
  });

  it('picks the language among plain bodies and among a Choice', () => {
    const plain = step([
      { kind: 'text', value: 'こんにちは', language: 'ja' },
      { kind: 'text', value: 'Hello', language: 'en' },
    ]);
    expect(storyBodies(plain, 'en').map((b) => b.value)).toEqual(['Hello']);
    expect(storyBodies(plain, 'fr').map((b) => b.value)).toEqual(['こんにちは']);
    const choice = step([
      { kind: 'text', value: 'こんにちは', language: 'ja', choice: 0 },
      { kind: 'text', value: 'Hello', language: 'en', choice: 0 },
    ]);
    expect(storyBodies(choice, 'ja').map((b) => b.value)).toEqual(['こんにちは']);
  });
});

describe('openingStep', () => {
  const story = storyOf(convertToV4(fixture('wakozukan-story.json')), 'ja');

  it('moves to the step the tab shows when the picture is not on it (scene 1 was skipped)', () => {
    expect(story).not.toBeNull();
    expect(openingStep(story!, 0, null)).toBe(0);
    expect(openingStep(story!, 3, 'https://example.org/other-mark')).toBe(3);
  });

  it('stays when that step is already selected, and clamps an index out of range', () => {
    expect(openingStep(story!, 0, story!.steps[0].id)).toBeNull();
    expect(openingStep(story!, 99, null)).toBe(story!.steps.length - 1);
    expect(openingStep(story!, -1, null)).toBe(0);
  });
});

describe('scrollOf (a story along one handscroll)', () => {
  const step = (id: string, region: StoryStep['region'], canvasId = 'c'): StoryStep => ({
    id,
    canvasId,
    region,
    bodies: [{ kind: 'text', value: id, format: 'text/plain' }],
  });
  const band = (x: number, w: number) => ({ type: 'rect' as const, x, y: 0, w, h: 100 });
  const story = (steps: StoryStep[]): Story => ({ steps, chapters: [] });

  it('reads a long picture with full-height scenes as a scroll, every scene viewed as a square of its height', () => {
    const s = scrollOf(story([step('intro', { type: 'canvas' }), step('a', band(800, 200)), step('b', band(0, 60))]), {
      width: 1000,
      height: 100,
    });
    expect(s?.spans).toEqual([null, [800, 1000], [0, 60]]);
    // centred on the scene, kept inside the picture
    expect(s?.views).toEqual([undefined, [850, 0, 100, 100], [0, 0, 100, 100]]);
  });

  it('is no scroll for a picture that is not long, or steps on several Canvases', () => {
    expect(scrollOf(story([step('a', band(0, 50)), step('b', band(50, 50))]), { width: 250, height: 100 })).toBeNull();
    expect(
      scrollOf(story([step('a', band(0, 50)), step('b', band(50, 50), 'd')]), { width: 1000, height: 100 }),
    ).toBeNull();
  });

  it('keeps the strip but fits each scene when the scenes are not full-height bands', () => {
    const s = scrollOf(story([step('a', band(0, 50)), step('b', { type: 'rect', x: 300, y: 20, w: 40, h: 30 })]), {
      width: 1000,
      height: 100,
    });
    expect(s?.spans).toEqual([[0, 50], [300, 340]]);
    expect(s?.views).toBeUndefined();
  });

  it('finds the step under a point of the strip: inside a span, the narrowest; outside, the nearest', () => {
    const s = scrollOf(
      story([step('wide', band(0, 500)), step('detail', { type: 'rect', x: 100, y: 10, w: 50, h: 50 }), step('c', band(700, 100))]),
      { width: 1000, height: 100 },
    )!;
    expect(stepAt(s, 120)).toBe(1);
    expect(stepAt(s, 300)).toBe(0);
    expect(stepAt(s, 650)).toBe(2);
  });
});

describe('readingTime', () => {
  const textStep = (value: string): StoryStep => ({
    id: 'x',
    canvasId: 'c',
    region: { type: 'canvas' },
    bodies: [{ kind: 'text', value, format: 'text/html' }],
  });

  it('grows with the text, within 6 to 16 seconds', () => {
    expect(readingTime(textStep('<h2>短い</h2>'), 'ja')).toBe(6000);
    const ja = readingTime(textStep(`<h2>見出し</h2><p>${'あ'.repeat(60)}</p>`), 'ja');
    expect(ja).toBeGreaterThan(9000);
    expect(ja).toBeLessThan(11000);
    expect(readingTime(textStep(`<p>${'word '.repeat(12)}</p>`), 'en')).toBe(10100);
    expect(readingTime(textStep(`<p>${'あ'.repeat(500)}</p>`), 'ja')).toBe(16000);
  });
});
