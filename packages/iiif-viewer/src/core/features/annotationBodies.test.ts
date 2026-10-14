import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { convertToV4 } from '../services/manifestConverter';
import { FALLBACK_PALETTE, fallbackStyleOf, paletteOrderOf } from './annotationStyle';
import { embeddedCanvasAnnotations } from './annotations';
import { pickWikidataLabel, wikidataIdOf, wikidataLabelUrl } from './wikidataLabel';

const load = (f: string) => convertToV4(JSON.parse(readFileSync(join(__dirname, '__fixtures__', f), 'utf8')));
const annosOf = (f: string) => {
  const m = load(f);
  const c = m.items[0] as unknown as { id: string; width: number; height: number };
  return embeddedCanvasAnnotations(m, c.id, c);
};

describe('Recipe 0377: Image body', () => {
  it('Image の本文を resource として読む（resourceType = Image）', () => {
    const a = annosOf('0377-image-in-annotation.json').find((x) => x.motivations.includes('commenting'))!;
    const img = a.bodies.find((b) => b.kind === 'resource')!;
    expect(img.resourceType).toBe('Image');
    expect(img.url).toMatch(/fountain\/full\/300,\/0\/default\.jpg$/);
    expect(a.bodies.some((b) => b.kind === 'text')).toBe(true);
  });
});

describe('Recipe 0326: layer annotation', () => {
  it('Choice の中の層につけた注釈を一覧に含め、層の名前を持たせる', () => {
    const list = annosOf('0326-annotating-image-layer.json');
    const tag = list.find((a) => a.motivations.includes('tagging'))!;
    expect(tag).toBeTruthy();
    expect(tag.layer?.label).toEqual({ en: ['X-ray'] });
    expect(tag.bodies[0].value).toBe('A group of skulls.');
    // image pixels -> Canvas (same size here)
    const r = tag.region as { type: string; x: number; y: number; w: number; h: number };
    expect(r.type).toBe('rect');
    expect([r.x, r.y, r.w, r.h].map(Math.round)).toEqual([810, 900, 260, 370]);
  });
});

describe('Recipe 0258: Wikidata', () => {
  it('URL から項目番号を取り出す', () => {
    expect(wikidataIdOf('http://www.wikidata.org/entity/Q18624915')).toBe('Q18624915');
    expect(wikidataIdOf('https://www.wikidata.org/wiki/Q42')).toBe('Q42');
    expect(wikidataIdOf('https://example.org/entity/Q1')).toBeUndefined();
    expect(wikidataIdOf(undefined)).toBeUndefined();
  });
  it('問い合わせ URL は UI の言語と en を含み、origin=* を付ける', () => {
    const u = wikidataLabelUrl('Q42', 'ja');
    expect(u).toContain('ids=Q42');
    expect(u).toContain('languages=ja|en');
    expect(u).toContain('origin=*');
  });
  it('ラベルは UI の言語 → en → 最初のもの', () => {
    const json = { entities: { Q1: { labels: { en: { value: 'Fountain' }, de: { value: 'Brunnen' } } } } };
    expect(pickWikidataLabel(json, 'Q1', 'ja')).toBe('Fountain');
    expect(pickWikidataLabel(json, 'Q1', 'de')).toBe('Brunnen');
    expect(pickWikidataLabel({ entities: { Q1: { labels: { fr: { value: 'Fontaine' } } } } }, 'Q1', 'ja')).toBe('Fontaine');
    expect(pickWikidataLabel({ entities: { Q1: {} } }, 'Q1', 'ja')).toBeUndefined();
    expect(pickWikidataLabel(null, 'Q1', 'ja')).toBeUndefined();
  });
});

describe('Recipe 0045: stylesheet を読めないときの代わりの配色', () => {
  const annos = annosOf('annotations/0045-annotation-styling.json').filter((a) => a.motivations.includes('commenting'));
  it('styleClass の違う注釈には違う色を割り当てる', () => {
    const order = paletteOrderOf(annos);
    expect(order.length).toBeGreaterThanOrEqual(2);
    const [s1, s2] = annos.map((a) => fallbackStyleOf(a, order)!);
    expect(s1.target.borderColor).not.toBe(s2.target.borderColor);
    expect(FALLBACK_PALETTE).toContain(s1.target.borderColor);
  });
  it('SpecificResource で包まれたテキストは URL ではなく本文として読む', () => {
    expect(annos.every((a) => a.bodies[0].kind === 'text' && /<p>/.test(a.bodies[0].value ?? ''))).toBe(true);
  });
  it('クラスの無い注釈は何も返さない', () => {
    expect(fallbackStyleOf({}, ['a'])).toBeNull();
  });
});
