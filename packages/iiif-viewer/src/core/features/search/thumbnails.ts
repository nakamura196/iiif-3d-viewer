// 一覧に出す小さな画像の URL。
//
// 大きさは「長い辺だけ」を指定する（w, か ,h）。「枠に収める」指定（!w,h）は Image API 2 / 3 の
// 規格にあるが、受け付けないサーバがある（2026-10-13、国立国会図書館の画像サーバは 500 を返した）。
// 元より大きくは頼まない（3 は拡大に ^ が要り、付けないと断られる）。

import { asList, idOf, isObject, num, typeOf, type Json } from './json';

interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Canvas の id の断片 #xywh=x,y,w,h（pixel: つきも）を読む。 */
export function regionOf(id: string): Region | undefined {
  const m = /#xywh=(?:pixel:)?([\d.]+),([\d.]+),([\d.]+),([\d.]+)/.exec(id);
  if (!m) return undefined;
  const [x, y, w, h] = m.slice(1).map(Number);
  return w > 0 && h > 0 ? { x, y, w, h } : undefined;
}

/** 幅 w・高さ h の画像を、長い辺が size 以下になるように頼む指定。 */
export const sizeParam = (w: number, h: number, size: number): string =>
  w >= h ? `${Math.round(Math.min(w, size))},` : `,${Math.round(Math.min(h, size))}`;

/** Canvas（3 に直したもの）に描かれた最初の画像の、画像サービスの URL。 */
const imageServiceOf = (canvas: Json): string | undefined => {
  for (const page of asList(canvas.items)) {
    if (!isObject(page)) continue;
    for (const anno of asList(page.items)) {
      if (!isObject(anno)) continue;
      let body = asList(anno.body)[0];
      if (typeOf(body) === 'Choice' && isObject(body)) body = asList(body.items)[0];
      if (!isObject(body)) continue;
      const id = idOf(asList(body.service).find(isObject));
      if (id) return id.replace(/\/info\.json$/, '').replace(/\/$/, '');
    }
  }
  return undefined;
};

export const firstThumbnailId = (v: unknown): string | undefined => {
  for (const t of asList(v)) {
    const id = idOf(t);
    if (id) return id;
  }
  return undefined;
};

/**
 * Canvas の小さな画像。region があれば画像サービスで切り出す。
 * 画像サービスが無ければ Canvas の thumbnail（切り出しのときは無し）。
 * 画像サービスの座標は Canvas の座標と同じと見なす（ほとんどの資料でそうなっている）。
 */
export function canvasThumbnail(canvas: Json, region?: Region, size = 240): string | undefined {
  const service = imageServiceOf(canvas);
  if (service) {
    if (region) {
      const r = [region.x, region.y, region.w, region.h].map(Math.round).join(',');
      return `${service}/${r}/${sizeParam(region.w, region.h, size)}/0/default.jpg`;
    }
    const w = num(canvas.width) ?? size;
    const h = num(canvas.height) ?? size;
    return `${service}/full/${sizeParam(w, h, size)}/0/default.jpg`;
  }
  return region ? undefined : firstThumbnailId(canvas.thumbnail);
}

/** マニフェスト（3 に直したもの）の小さな画像。thumbnail が無ければ最初の Canvas から作る。 */
export function manifestThumbnail(manifest: Json, size = 240): string | undefined {
  const own = firstThumbnailId(manifest.thumbnail);
  if (own) return own;
  const first = asList(manifest.items).find(isObject);
  return first ? canvasThumbnail(first, undefined, size) : undefined;
}
