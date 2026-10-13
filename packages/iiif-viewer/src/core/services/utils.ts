import { isCuration, resolveCuration } from '../features/curation';
import { upgradeToV3 } from './upgradeV2';

const getJson = async (url: string): Promise<unknown> => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}`);
  return response.json();
};

/**
 * URL の JSON を取ってくる。http:// で読めなければ https:// でもう一度試す
 * （https のページからは http に繋げない。古いマニフェストやキュレーションは http:// で書かれていることが多い）。
 */
export const fetchJson = async (url: string): Promise<unknown> => {
  try {
    return await getJson(url);
  } catch (error) {
    if (!/^http:\/\//i.test(url)) throw error;
    return getJson(url.replace(/^http:/i, 'https:'));
  }
};

export const fetchManifest = async (manifestUrl: string) => {
  try {
    const raw = await fetchJson(manifestUrl);
    // キュレーション（cr:Curation）は、元のマニフェストを取ってきて 1 冊の仮のマニフェストにする
    if (isCuration(raw)) {
      const built = await resolveCuration(raw, fetchJson);
      if (!built) throw new Error('No canvas of the curation could be read');
      return built;
    }
    // Presentation 2 は 3 に直してから渡す（3 / 4 はそのまま）
    return upgradeToV3(raw);
  } catch (error) {
    console.error('Error fetching manifest:', error);
    return null;
  }
};
