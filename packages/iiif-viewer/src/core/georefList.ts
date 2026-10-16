// ジオリファレンスの画面（/georef）の地点の一覧: 文字での検索とタグでの絞り込み。
// geo.ldas.jp（nakamura196/iiif_geo の components/panes/Search.vue）に合わせ、
// 名前・ID・タグを探し、カタカナとひらがなを区別しない。タグは選んだもののどれかを持てば残す。

import { tagKey, type Facet } from './annotationFilter';
import { geoFeatureTagsOf, type GeoFeature } from './services/manifestParser';
import type { Annotation } from './types/main';

/**
 * 比べる前に文字をそろえる。全角・半角（NFKC）、カタカナ→ひらがな、大文字→小文字。
 * geo.ldas.jp はカタカナ→ひらがなと大文字だけをそろえていた。半角カナや全角英数も同じに扱う
 */
export const foldGeorefText = (s: string): string =>
  s
    .normalize('NFKC')
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .toLowerCase();

const stripHtml = (html: string): string => html.replace(/<[^>]*>/g, ' ');

/** 地点の、検索の対象になる文字（名前・別名・ID・タグ・説明）。 */
export const georefSearchText = (feature: GeoFeature, annotation?: Annotation): string =>
  foldGeorefText(
    [
      feature.properties.title,
      ...(feature.names ?? []).map((n) => n.toponym),
      feature.id ?? '',
      feature['@id'] ?? '',
      ...geoFeatureTagsOf(feature),
      ...(annotation?.tags ?? []).map(tagKey),
      annotation ? stripHtml(annotation.description) : '',
    ].join('\n')
  );

export interface GeorefListFilter {
  query: string;
  /** tagKey() の値。 */
  tags: string[];
}

/**
 * 条件に合う地点の番号（features の並びの位置）。annotations は features と同じ並び（geoAnnotations の結果）。
 * 空白で区切った語はすべてを含むものを残す。タグは選んだもののどれかを持つものを残す
 */
export const filterGeorefFeatures = (
  features: GeoFeature[],
  annotations: Annotation[],
  filter: GeorefListFilter
): number[] => {
  const terms = foldGeorefText(filter.query).split(/\s+/).filter(Boolean);
  const out: number[] = [];
  features.forEach((feature, i) => {
    const annotation = annotations[i];
    if (filter.tags.length > 0 && !(annotation?.tags ?? []).some((t) => filter.tags.includes(tagKey(t)))) return;
    if (terms.length > 0) {
      const text = georefSearchText(feature, annotation);
      if (!terms.every((term) => text.includes(term))) return;
    }
    out.push(i);
  });
  return out;
};

/** タグと件数。多い順、同じ件数なら一覧に先に出た順（geo.ldas.jp と同じ）。 */
export const georefTagFacets = (annotations: Annotation[]): Facet[] => {
  const counts = new Map<string, number>();
  for (const a of annotations) {
    // 1 つの地点に同じタグが 2 度書かれていても 1 と数える
    for (const key of new Set((a.tags ?? []).map(tagKey))) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count);
};
