import { isCuration, resolveCuration } from '../features/curation';
import { upgradeToV3 } from './upgradeV2';
import { isImageInfoJson } from '../features/compareSources';
import { manifestFromImageInfo } from './imageInfoManifest';
import { manifestFromCanvas } from './canvasManifest';
import { manifestFromAnnotationPage } from './annotationPageManifest';
import { inlineSharedServices } from './sharedServices';

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
    // 画像 1 枚の info.json は、その画像だけを載せた仮のマニフェストにする
    if (isImageInfoJson(raw)) {
      const built = manifestFromImageInfo(raw, manifestUrl);
      if (!built) throw new Error('The image information could not be read');
      return built;
    }
    // Canvas 単体（geo.ldas.jp の canvas.json など）は、その Canvas だけを載せた仮のマニフェストにする
    const fromCanvas = manifestFromCanvas(raw, manifestUrl);
    if (fromCanvas) return fromCanvas;
    // AnnotationPage 単体（geo.ldas.jp・Allmaps の地点の注釈）は、注釈が指す画像ごとに Canvas を立てたマニフェストにする
    const fromPage = manifestFromAnnotationPage(raw, manifestUrl);
    if (fromPage) return fromPage;
    // キュレーション（cr:Curation）は、元のマニフェストを取ってきて 1 冊の仮のマニフェストにする
    if (isCuration(raw)) {
      const built = await resolveCuration(raw, fetchJson);
      if (!built) throw new Error('No canvas of the curation could be read');
      return built;
    }
    // Presentation 2 は 3 に直してから渡す（3 / 4 はそのまま）。末尾の services への参照は中身に置き換える
    return inlineSharedServices(upgradeToV3(raw));
  } catch (error) {
    console.error('Error fetching manifest:', error);
    return null;
  }
};
