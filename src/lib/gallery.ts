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
