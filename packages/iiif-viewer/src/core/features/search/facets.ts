// 絞り込みと集計（ファセット）。読み手が作った項目の並びだけを見る（どこから読んだかは問わない）。
// 語句は「ラベルとメタデータの値」に対して、空白で区切った語をすべて含むものを残す。
// ファセットは、同じ項目の中の値は「または」、項目どうしは「かつ」でつなぐ。

import type { SearchItem } from './types';

/** 選んだ値。項目名 → 値（同じ項目の中は「または」、項目どうしは「かつ」）。 */
export type FacetSelection = Record<string, string[]>;

export interface SearchFacet {
  key: string;
  /** 値と件数。件数の多い順 */
  values: { value: string; count: number }[];
}

/** 語句が、ラベルかメタデータの値のどれかに含まれるか（大文字小文字は区別しない）。 */
export function matchesQuery(item: SearchItem, query: string): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const text = [item.label, ...Object.values(item.metadata).flat()].join('\n').toLowerCase();
  return words.every((w) => text.includes(w));
}

const matchesSelection = (item: SearchItem, selection: FacetSelection, except?: string): boolean =>
  Object.entries(selection).every(
    ([key, values]) => key === except || values.length === 0 || (item.metadata[key] ?? []).some((v) => values.includes(v)),
  );

export function filterItems(items: SearchItem[], query: string, selection: FacetSelection): SearchItem[] {
  return items.filter((it) => matchesQuery(it, query) && matchesSelection(it, selection));
}

/**
 * ファセット。項目名は出てきた順。件数は「語句と、その項目以外の選択」で絞った後の数
 * （同じ項目の別の値を選び足したときに何件になるかが分かるように）。
 * 選んだ値は件数が 0 でも残す。値が 1 種類しかない項目と、ほとんど値が違う項目（ID など）は出さない。
 */
export function facetsOf(items: SearchItem[], query: string, selection: FacetSelection): SearchFacet[] {
  const keys: string[] = [];
  const distinct = new Map<string, Set<string>>();
  for (const it of items) {
    for (const [k, vs] of Object.entries(it.metadata)) {
      if (!distinct.has(k)) {
        keys.push(k);
        distinct.set(k, new Set());
      }
      for (const v of vs) distinct.get(k)!.add(v);
    }
  }
  const byQuery = items.filter((it) => matchesQuery(it, query));
  const out: SearchFacet[] = [];
  for (const key of keys) {
    const n = distinct.get(key)!.size;
    const withKey = items.filter((it) => it.metadata[key]?.length).length;
    // ほとんどの値が違う項目（ID・寸法・要約など）は、絞り込みに使えないので出さない
    if (n < 2 || (n > 20 && n > withKey * 0.6)) continue;
    const counts = new Map<string, number>();
    for (const it of byQuery) {
      if (!matchesSelection(it, selection, key)) continue;
      for (const v of it.metadata[key] ?? []) counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    for (const v of selection[key] ?? []) if (!counts.has(v)) counts.set(v, 0);
    const values = [...counts]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, undefined, { numeric: true }));
    out.push({ key, values });
  }
  return out;
}
