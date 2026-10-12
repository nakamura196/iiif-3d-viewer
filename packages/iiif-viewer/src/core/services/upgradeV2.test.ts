import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { canvasImagesOf } from '../features/image';
import { convertToV4 } from './manifestConverter';
import { isPresentation2, upgradeToV3 } from './upgradeV2';

// シェリー書簡（東京大学総合図書館）の manifest。2026-10-12 に
// https://utda.github.io/shelley/iiif/shelley/manifest.json から保存した。
// 元画像と透過光画像の oa:Choice で、Choice 自身に format と .jpg の @id が付いている。
const shelley = () =>
  JSON.parse(readFileSync(fileURLToPath(new URL('./__fixtures__/v2-shelley-choice.json', import.meta.url)), 'utf8'));

describe('upgradeToV3', () => {
  it('Presentation 2 の Choice を、候補を潰さずに 3 にする', () => {
    const m = upgradeToV3(shelley()) as { '@context': string; type: string; items: unknown[] };
    expect(m['@context']).toBe('http://iiif.io/api/presentation/3/context.json');
    expect(m.type).toBe('Manifest');
    const images = canvasImagesOf(m.items[0]);
    expect(images.paintings).toHaveLength(1);
    const options = images.paintings[0].options;
    expect(options.map((o) => o.label)).toEqual([{ none: ['元画像'] }, { none: ['透過光画像'] }]);
    expect(options.map((o) => o.layer?.service)).toEqual([
      { id: 'https://utda.github.io/shelley/files/tile/original', version: 2 },
      { id: 'https://utda.github.io/shelley/files/tile/toka', version: 2 },
    ]);
  });

  it('変換した manifest は、そのまま読み込み時の変換（4 へ）に渡せる', () => {
    expect(() => convertToV4(upgradeToV3(shelley()))).not.toThrow();
  });

  it('3 と 4 には手を入れない', () => {
    const v3 = { '@context': 'http://iiif.io/api/presentation/3/context.json', id: 'https://example.org/m', type: 'Manifest', items: [] };
    const v4 = { '@context': 'http://iiif.io/api/presentation/4/context.json', id: 'https://example.org/m', type: 'Manifest', items: [] };
    expect(upgradeToV3(v3)).toBe(v3);
    expect(upgradeToV3(v4)).toBe(v4);
    expect(isPresentation2(v3)).toBe(false);
  });

  it('@context の無い 2 も、@id と sc:Manifest で見分ける', () => {
    expect(isPresentation2({ '@id': 'https://example.org/m', '@type': 'sc:Manifest' })).toBe(true);
  });
});
