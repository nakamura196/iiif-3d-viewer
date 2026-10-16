// 地名検索（地図と画像の画面 /georef の地図）。OpenStreetMap の Nominatim に聞く（geo.ldas.jp と同じ）。
// Nominatim の利用規約に合わせ、入力のたびには聞かず、検索ボタン（Enter）を押したときだけ 1 回聞く。
// https://operations.osmfoundation.org/policies/nominatim/

export interface PlaceResult {
  name: string;
  /** 種類（city, station など）。 */
  type?: string;
  lat: number;
  lng: number;
}

const ENDPOINT = 'https://nominatim.openstreetmap.org/search';

export async function searchPlaces(query: string, lang: string, signal?: AbortSignal): Promise<PlaceResult[]> {
  const q = query.trim();
  if (!q) return [];
  const params = new URLSearchParams({ format: 'jsonv2', q, limit: '10', 'accept-language': lang });
  const res = await fetch(`${ENDPOINT}?${params}`, { signal });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  return parsePlaces(await res.json());
}

/** Nominatim の答えから、座標の読めるものだけを取り出す。 */
export function parsePlaces(data: unknown): PlaceResult[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap((d) => {
    const lat = Number(d?.lat);
    const lng = Number(d?.lon);
    const name = typeof d?.display_name === 'string' ? d.display_name : '';
    if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) return [];
    return [{ name, type: typeof d.type === 'string' ? d.type : undefined, lat, lng }];
  });
}
