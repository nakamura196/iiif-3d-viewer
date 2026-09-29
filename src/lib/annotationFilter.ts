// Text search and creator / tag facets for the annotation list.
// Within one facet the selected values are OR-ed; across facets (and with the
// text query) they are AND-ed.

import type { Annotation, AnnotationTag } from '@/types/main';

export interface AnnotationFilter {
  query: string;
  creators: string[];
  // Tag keys as produced by tagKey().
  tags: string[];
}

export const EMPTY_FILTER: AnnotationFilter = { query: '', creators: [], tags: [] };

export const isFilterActive = (f: AnnotationFilter): boolean =>
  f.query.trim() !== '' || f.creators.length > 0 || f.tags.length > 0;

export const tagKey = (tag: AnnotationTag): string =>
  tag.key ? `${tag.key}: ${tag.value}` : tag.value;

const stripHtml = (html: string): string => html.replace(/<[^>]*>/g, ' ');

const searchableText = (a: Annotation): string =>
  [a.title, stripHtml(a.description), a.creator, ...(a.tags ?? []).map(tagKey)]
    .join('\n')
    .toLowerCase();

export const filterAnnotations = (
  annotations: Annotation[],
  filter: AnnotationFilter,
): Annotation[] => {
  const terms = filter.query.toLowerCase().split(/\s+/).filter(Boolean);
  return annotations.filter((a) => {
    if (filter.creators.length > 0 && !filter.creators.includes(a.creator)) return false;
    if (filter.tags.length > 0 && !(a.tags ?? []).some((t) => filter.tags.includes(tagKey(t)))) {
      return false;
    }
    if (terms.length === 0) return true;
    const text = searchableText(a);
    return terms.every((term) => text.includes(term));
  });
};

export interface Facet {
  value: string;
  count: number;
}

const countBy = (values: string[]): Facet[] => {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts].map(([value, count]) => ({ value, count }));
};

export const creatorFacets = (annotations: Annotation[]): Facet[] =>
  countBy(annotations.map((a) => a.creator).filter(Boolean));

export const tagFacets = (annotations: Annotation[]): Facet[] =>
  countBy(annotations.flatMap((a) => (a.tags ?? []).map(tagKey)));
