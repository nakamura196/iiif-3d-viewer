import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { convertToV4 } from '../services/manifestConverter';
import { splitHeading, stepTarget, stepText, storyBodies, storyOf, type StoryStep } from './story';

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
