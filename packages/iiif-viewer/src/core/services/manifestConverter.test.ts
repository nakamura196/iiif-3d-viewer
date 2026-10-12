import { describe, expect, it } from 'vitest';
import { convertToV4 } from './manifestConverter';

describe('convertToV4: Canvas -> Scene', () => {
  it('Canvas の説明用の項目（メタデータ・要約・権利・日時など）を Scene に残す', () => {
    const manifest = {
      '@context': 'http://iiif.io/api/presentation/3/context.json',
      id: 'https://example.org/m',
      type: 'Manifest',
      items: [
        {
          id: 'https://example.org/c1',
          type: 'Canvas',
          label: { en: ['c'] },
          metadata: [{ label: { en: ['a'] }, value: { en: ['b'] } }],
          summary: { en: ['s'] },
          rights: 'https://creativecommons.org/licenses/by/4.0/',
          navDate: '2020-01-01T00:00:00Z',
          items: [],
        },
      ],
    };
    const scene = convertToV4(manifest).items[0] as unknown as Record<string, unknown>;
    expect(scene.type).toBe('Scene');
    expect(scene.metadata).toEqual(manifest.items[0].metadata);
    expect(scene.summary).toEqual({ en: ['s'] });
    expect(scene.rights).toBe(manifest.items[0].rights);
    expect(scene.navDate).toBe('2020-01-01T00:00:00Z');
  });
});
