import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { SAMPLES, sampleById } from './samples';
import { COOKBOOK_RECIPES, recipeById } from './cookbookRecipes';

describe('SAMPLES', () => {
  it('sampleById は id で引け、無い id は undefined', () => {
    for (const s of SAMPLES) expect(sampleById(s.id)).toBe(s);
    expect(sampleById('no-such-id')).toBeUndefined();
  });

  it('id は重複せず、URL に使える形で、既存の静的ページ /samples/kasane と衝突しない', () => {
    const ids = SAMPLES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(id).not.toBe('kasane');
    }
  });

  it('詳細ページの og:image になるサムネイルが public/ にある', () => {
    for (const s of SAMPLES) {
      expect(existsSync(join(__dirname, '../../public/thumbnails/samples', `${s.id}.webp`)), s.id).toBe(true);
    }
  });
});

describe('COOKBOOK_RECIPES の詳細ページ', () => {
  it('recipeById は id で引け、無い id は undefined', () => {
    for (const r of COOKBOOK_RECIPES) expect(recipeById(r.id)).toBe(r);
    expect(recipeById('no-such-id')).toBeUndefined();
  });

  it('id は重複せず、URL に使える形で、/samples/kasane と衝突しない', () => {
    const ids = COOKBOOK_RECIPES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(id).not.toBe('kasane');
    }
  });
});
