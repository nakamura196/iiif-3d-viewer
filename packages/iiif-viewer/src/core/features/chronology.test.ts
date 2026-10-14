import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { chronologyOf, hasChronology, navDateKey, navDateText, yearText } from './chronology';
import { collectionEntriesOf, manifestThumbnailOf, type CollectionEntry } from './structure';

const raw = (name: string) => JSON.parse(readFileSync(new URL(`./__fixtures__/chronology/${name}.json`, import.meta.url), 'utf8'));
const e = (id: string, navDate?: string): CollectionEntry => ({ id, type: 'Manifest', label: id, navDate });

describe('0230 navDate on a Collection', () => {
  it('items keep their navDate', () => {
    const entries = collectionEntriesOf(raw('0230-navdate-collection'));
    expect(entries.map((x) => x.navDate)).toEqual(['1986-01-01T00:00:00Z', '1987-01-01T00:00:00Z']);
    expect(hasChronology(entries)).toBe(true);
  });
  it('grouped by year', () => {
    const c = chronologyOf(collectionEntriesOf(raw('0230-navdate-collection')));
    expect(c.years.map((y) => y.year)).toEqual([1986, 1987]);
    expect(c.undated).toEqual([]);
  });
});

describe('chronologyOf', () => {
  it('sorts by date, keeps ties in order, puts undated last', () => {
    const c = chronologyOf([e('a', '1990-05-01T00:00:00Z'), e('b'), e('c', '1985-01-01T00:00:00Z'), e('d', '1990-01-02T00:00:00Z'), e('f', '1990-01-02T00:00:00Z'), e('g', 'unknown')]);
    expect(c.years.map((y) => [y.year, y.entries.map((x) => x.entry.id)])).toEqual([
      [1985, ['c']],
      [1990, ['d', 'f', 'a']],
    ]);
    expect(c.undated.map((x) => x.id)).toEqual(['b', 'g']);
  });
  it('BCE and five-digit years', () => {
    const c = chronologyOf([e('a', '0100-01-01T00:00:00Z'), e('b', '-0499-01-01T00:00:00Z'), e('c', '12000-01-01T00:00:00Z')]);
    expect(c.years.map((y) => y.year)).toEqual([-499, 100, 12000]);
  });
  it('needs two dated items', () => {
    expect(hasChronology([e('a', '1990'), e('b')])).toBe(false);
    expect(hasChronology([e('a', '1990'), e('b', '1991')])).toBe(true);
  });
});

describe('text', () => {
  it('navDateKey reads year-only and full values', () => {
    expect(navDateKey('1990')?.year).toBe(1990);
    expect(navDateKey('nope')).toBeNull();
  });
  it('1 January at midnight reads as the year', () => {
    expect(navDateText('1986-01-01T00:00:00Z', 'en')).toBe('1986');
    expect(navDateText('1776-07-04T00:00:00Z', 'en')).toMatch(/Jul.*1776/);
    expect(navDateText('1776-07-04T00:00:00Z', 'ja')).toMatch(/1776年7月4日/);
  });
  it('BCE', () => {
    expect(yearText(-499, 'en')).toBe('500 BCE');
    expect(yearText(-499, 'ja')).toBe('紀元前 500');
    expect(navDateText('-0499-06-01T00:00:00Z', 'en')).toBe('500 BCE');
  });
});

describe('manifestThumbnailOf', () => {
  it('0230: an item without a thumbnail gets one from the Image API of its first image', () => {
    expect(manifestThumbnailOf(raw('0230-navdate_map_1-manifest'), 96)).toBe(
      'https://iiif.io/api/image/3.0/example/reference/43153e2ec7531f14dd1c9b2fc401678a-88695674/full/,96/0/default.jpg',
    );
  });
  it('prefers the thumbnail of the Manifest, then of the first Canvas', () => {
    const canvas = { type: 'Canvas', thumbnail: [{ id: 'c.jpg' }], items: [] };
    expect(manifestThumbnailOf({ thumbnail: [{ id: 'm.jpg' }], items: [canvas] })).toBe('m.jpg');
    expect(manifestThumbnailOf({ items: [canvas] })).toBe('c.jpg');
  });
  it('uses the first choice of a Choice, and the image itself without a service', () => {
    const anno = (body: unknown) => ({ items: [{ type: 'Canvas', items: [{ items: [{ motivation: 'painting', body }] }] }] });
    expect(manifestThumbnailOf(anno({ type: 'Choice', items: [{ type: 'Image', id: 'a.jpg' }, { type: 'Image', id: 'b.jpg' }] }))).toBe('a.jpg');
    expect(manifestThumbnailOf(anno({ type: 'Sound', id: 'a.mp3' }))).toBeUndefined();
    expect(manifestThumbnailOf(null)).toBeUndefined();
  });
});
