// IIIF バーチャル美術館（/gallery/）に渡せるかの判定。展示室の壁に掛けるのは画像なので、
// 画像を含む Manifest と、Collection・Curation（中に画像の Manifest を持つ）だけを対象にする。
// 3D や音声・動画だけの Manifest では、美術館に入っても壁が空になる。

type Json = unknown;

const IMAGE_TYPES = new Set(['Image', 'dctypes:Image']);

function hasImageBody(node: Json, depth = 0): boolean {
  if (depth > 12 || node === null || typeof node !== 'object') return false;
  if (Array.isArray(node)) return node.some((n) => hasImageBody(n, depth + 1));
  const o = node as Record<string, Json>;
  const type = o.type ?? o['@type'];
  if (typeof type === 'string' && IMAGE_TYPES.has(type)) return true;
  // v3: items / body、v2: sequences / canvases / images / resource
  for (const key of ['items', 'body', 'sequences', 'canvases', 'images', 'resource']) {
    if (key in o && hasImageBody(o[key], depth + 1)) return true;
  }
  return false;
}

export function canOpenInGallery(raw: Json): boolean {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const o = raw as Record<string, Json>;
  const type = o.type ?? o['@type'];
  if (type === 'Collection' || type === 'sc:Collection' || type === 'cr:Curation') return true;
  return hasImageBody(o);
}

// 美術館に入るときの設定。どれも /gallery/ の URL 引数になる（engine/main.js が読む）。
export type GalleryMode = 'thirdperson' | 'walk' | 'orbit';
export type GalleryQuality = 'auto' | 'high' | 'medium' | 'low';
export type GalleryLook = 'standard' | 'museum';

export interface GalleryOptions {
  mode?: GalleryMode;
  quality?: GalleryQuality;
  look?: GalleryLook;
  /** 壁に掛ける最大の枚数。省略すると美術館の既定（Manifest・Collection は 24、Curation は 64） */
  limit?: number;
}

// Manifest を ?u= で開くと、美術館は「見回す」で入る（三人称は ?mode= で頼んだときだけ）
export const GALLERY_MODES: GalleryMode[] = ['orbit', 'thirdperson', 'walk'];
export const GALLERY_QUALITIES: GalleryQuality[] = ['auto', 'high', 'medium', 'low'];
export const GALLERY_LOOKS: GalleryLook[] = ['standard', 'museum'];
export const GALLERY_LIMITS = [12, 24, 48, 96] as const;

/** /gallery/ へのリンクの ? 以降。既定の値（見回す・画質の自動・標準の内装）は書かない。 */
export function galleryQuery(url: string, opts: GalleryOptions = {}): string {
  const q = new URLSearchParams({ u: url });
  if (opts.mode && opts.mode !== 'orbit') q.set('mode', opts.mode);
  if (opts.quality && opts.quality !== 'auto') q.set('quality', opts.quality);
  if (opts.look === 'museum') q.set('look', 'museum');
  if (opts.limit && opts.limit > 0) q.set('limit', String(Math.floor(opts.limit)));
  return q.toString();
}
