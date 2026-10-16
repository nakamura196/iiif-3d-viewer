import { afterEach, describe, expect, it, vi } from 'vitest';
import { parsePlaces, searchPlaces } from './placeSearch';

describe('parsePlaces', () => {
  it('Nominatim の答えから名前・種類・座標を取り出す', () => {
    expect(
      parsePlaces([{ display_name: '東京大学, 文京区', type: 'university', lat: '35.7126', lon: '139.7620' }])
    ).toEqual([{ name: '東京大学, 文京区', type: 'university', lat: 35.7126, lng: 139.762 }]);
  });

  it('座標か名前の無いものは捨てる', () => {
    expect(parsePlaces([{ display_name: 'x', lat: 'a', lon: '1' }, { lat: '1', lon: '1' }, null])).toEqual([]);
    expect(parsePlaces({ error: 'bad' })).toEqual([]);
  });
});

describe('searchPlaces', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('空の入力では聞かない', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    expect(await searchPlaces('  ', 'ja')).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('画面の言語で 10 件まで聞く', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
    vi.stubGlobal('fetch', fetch);
    await searchPlaces('本郷', 'en');
    const url = new URL(fetch.mock.calls[0][0]);
    expect(url.searchParams.get('q')).toBe('本郷');
    expect(url.searchParams.get('accept-language')).toBe('en');
    expect(url.searchParams.get('limit')).toBe('10');
  });

  it('失敗したら投げる', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429 }));
    await expect(searchPlaces('x', 'ja')).rejects.toThrow('429');
  });
});
