// Image API の info.json（画像 1 枚の情報）を、その画像だけを載せた仮のマニフェスト（Presentation 3）にする。
// ビューアはマニフェストを 1 つ読む作りなので、キュレーション（curation.ts）と同じく入口で形をそろえる。
// 見比べのページ（compareSources.ts の infoCandidateOf）と同じ規則で id と名前を決める。

import { parseImageInfo } from '../features/image';

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);

/** The id of the image service: the info.json's own id, or the URL without "/info.json". */
const serviceIdOf = (json: Json, url: string): string =>
  String(json.id ?? json['@id'] ?? url.replace(/\/info\.json(\?.*)?$/, '')).replace(/\/+$/, '');

/** A one-Canvas Manifest that paints the whole image of an info.json. null when it is not one. */
export const manifestFromImageInfo = (json: unknown, url: string): Json | null => {
  const info = parseImageInfo(json);
  if (!info || !isObj(json)) return null;
  const id = serviceIdOf(json, url);
  const parts = id.split('/').filter(Boolean);
  const name = decodeURIComponent(parts[parts.length - 1] ?? id);
  const v3 = info.version === 3;

  // 認証のサービス（Auth 2.0 の probe など）は info.json の service にあるので、そのまま引き継ぐ
  const service: Json = v3
    ? { id, type: 'ImageService3', profile: json.profile ?? 'level0' }
    : { '@id': id, '@type': 'ImageService2', profile: json.profile ?? 'http://iiif.io/api/image/2/level0.json' };
  if (json.service !== undefined) service.service = json.service;

  const base = url.replace(/\/info\.json(\?.*)?$/, '');
  const canvasId = `${base}/canvas/1`;
  return {
    '@context': 'http://iiif.io/api/presentation/3/context.json',
    id: url,
    type: 'Manifest',
    label: { none: [name] },
    items: [
      {
        id: canvasId,
        type: 'Canvas',
        width: info.width,
        height: info.height,
        items: [
          {
            id: `${canvasId}/page`,
            type: 'AnnotationPage',
            items: [
              {
                id: `${canvasId}/page/image`,
                type: 'Annotation',
                motivation: 'painting',
                target: canvasId,
                body: {
                  id: `${id}/full/${v3 ? 'max' : 'full'}/0/default.jpg`,
                  type: 'Image',
                  format: 'image/jpeg',
                  width: info.width,
                  height: info.height,
                  service: [service],
                },
              },
            ],
          },
        ],
      },
    ],
  };
};
