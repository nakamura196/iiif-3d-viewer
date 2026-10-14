// 推論に渡す画像を用意する。表示中のタイルではなく、Canvas の画像を、モデルに合う大きさで取り直す。
// IIIF Image API があれば幅を指定して取る。無ければ画像そのもの。画素を読むので、画像のサーバが
// 他所からの読み取り（CORS）を許していないと読めない（ビューアの表示も同じ条件で読んでいる）。
import {
  canvasImagesOf,
  imageInfoUrl,
  imageRequestUrl,
  imageToCanvasOf,
  parseImageInfo,
  rawCanvasOf,
  singleImageUrl,
  type ContainerInfo,
  type ImageLayer,
  type ImageToCanvas,
  type ManifestV4,
} from '../../core';

export class SourceImageError extends Error {
  constructor(public readonly reason: 'noImage' | 'unsupported' | 'fetch') {
    super(reason);
  }
}

/** The first image painted on the Canvas (the base layer). */
export const baseImageLayerOf = (manifest: ManifestV4 | null | undefined, container: ContainerInfo | undefined): ImageLayer | undefined => {
  if (!container || container.kind !== 'Canvas') return undefined;
  const images = canvasImagesOf(rawCanvasOf(manifest, container.id));
  for (const p of images.paintings) for (const o of p.options) if (o.kind === 'Image' && o.layer) return o.layer;
  return undefined;
};

const urlFor = async (layer: ImageLayer, longSide: number): Promise<string> => {
  if (!layer.service) return layer.url;
  const res = await fetch(imageInfoUrl(layer.service));
  const info = res.ok ? parseImageInfo(await res.json()) : null;
  if (!info) return layer.url;
  const k = Math.min(1, longSide / Math.max(info.width, info.height));
  const width = Math.max(1, Math.round(info.width * k));
  if (info.level >= 1) return imageRequestUrl(layer.service, 'full', width);
  return singleImageUrl(layer.service, info, width);
};

/** The image to give a model (at most `longSide` on the long side), and how its pixels map to the Canvas. */
export const loadSourceImage = async (
  layer: ImageLayer,
  container: ContainerInfo,
  longSide: number,
): Promise<{ bitmap: ImageBitmap; map: ImageToCanvas; url: string }> => {
  // 切り抜き・回転した画像は、結果の置き直しに未対応（先に断る）
  if (!imageToCanvasOf(layer, container, 1, 1)) throw new SourceImageError('unsupported');
  let url: string;
  let bitmap: ImageBitmap;
  try {
    url = await urlFor(layer, longSide);
    const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    bitmap = await createImageBitmap(blob);
  } catch {
    throw new SourceImageError('fetch');
  }
  // サーバが大きいまま返したときは、ここで縮める
  const k = longSide / Math.max(bitmap.width, bitmap.height);
  if (k < 1) {
    const w = Math.round(bitmap.width * k);
    const h = Math.round(bitmap.height * k);
    const small = await createImageBitmap(bitmap, { resizeWidth: w, resizeHeight: h, resizeQuality: 'high' });
    bitmap.close();
    bitmap = small;
  }
  const map = imageToCanvasOf(layer, container, bitmap.width, bitmap.height);
  if (!map) {
    bitmap.close();
    throw new SourceImageError('unsupported');
  }
  return { bitmap, map, url };
};
