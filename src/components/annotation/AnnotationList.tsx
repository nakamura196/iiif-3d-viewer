import {
  annotationFilterAtom,
  annotationsAtom,
  selectedAnnotationIdAtom,
  visibleAnnotationsAtom,
} from '@/atoms/infoPanelAtom';
import { useAtom } from 'jotai';
import { useEffect, useMemo, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { SeeAlso, type PrimitivesExternalWebResource } from '@/components/iiif/primitives';
import AnnotationImages from '@/components/annotation/AnnotationImages';
import { groupByRegion } from '@/lib/regions';
import {
  EMPTY_FILTER,
  creatorFacets,
  isFilterActive,
  tagFacets,
  tagKey,
  type Facet,
} from '@/lib/annotationFilter';
import type { Annotation } from '@/types/main';

export default function AnnotationList() {
  const t = useTranslations('Annotation');
  const [annotations] = useAtom(annotationsAtom);
  const [visibleAnnotations] = useAtom(visibleAnnotationsAtom);
  const [filter, setFilter] = useAtom(annotationFilterAtom);
  const [selectedAnnotationId, setSelectedAnnotationId] = useAtom(selectedAnnotationIdAtom);
  const selectedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedAnnotationId && selectedRef.current) {
      selectedRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  }, [selectedAnnotationId]);

  const focusOnAnnotation = (annotationId: string) => {
    setSelectedAnnotationId(annotationId);
  };

  // 別のマニフェストを開いたら、検索・絞り込みを解除する
  useEffect(() => {
    setFilter(EMPTY_FILTER);
  }, [annotations, setFilter]);

  const creators = useMemo(() => creatorFacets(annotations), [annotations]);
  const tags = useMemo(() => tagFacets(annotations), [annotations]);

  const toggle = (facet: 'creators' | 'tags', value: string) =>
    setFilter((f) => ({
      ...f,
      [facet]: f[facet].includes(value) ? f[facet].filter((v) => v !== value) : [...f[facet], value],
    }));

  const renderFacet = (facet: 'creators' | 'tags', label: string, items: Facet[]) =>
    items.length > 0 && (
      <div className="mb-3">
        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</div>
        <div className="flex flex-wrap gap-1.5">
          {items.map((item) => {
            const active = filter[facet].includes(item.value);
            return (
              <button
                key={item.value}
                type="button"
                aria-pressed={active}
                onClick={() => toggle(facet, item.value)}
                className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                  active
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 border-transparent text-gray-700 dark:text-gray-200 hover:border-blue-300'
                }`}
              >
                {item.value} ({item.count})
              </button>
            );
          })}
        </div>
      </div>
    );

  // 同じ場所（target.id が同じ）の注釈を 1 つの枠にまとめる
  const regionGroups = useMemo(() => groupByRegion(visibleAnnotations), [visibleAnnotations]);
  const numberOf = useMemo(
    () => new Map(annotations.map((a, i) => [a.id, i + 1])),
    [annotations],
  );

  const renderCard = (annotation: Annotation) => (
    <div
      key={annotation.id}
      ref={selectedAnnotationId === annotation.id ? selectedRef : null}
      onClick={() => focusOnAnnotation(annotation.id)}
      className={`group rounded-lg shadow-sm hover:shadow-md transition-all duration-200 
          cursor-pointer border overflow-hidden
          ${
            selectedAnnotationId === annotation.id
              ? 'bg-blue-50 dark:bg-blue-900 border-blue-300 dark:border-blue-700'
              : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-600'
          }`}
    >
      <div className="p-4">
        {/* ヘッダー部分 */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-sm font-medium
                            ${
                              selectedAnnotationId === annotation.id
                                ? 'bg-blue-600'
                                : 'bg-blue-500'
                            }`}
            >
              {numberOf.get(annotation.id)}
            </div>
            <div
              className={`ml-3 text-sm font-medium
                            ${
                              selectedAnnotationId === annotation.id
                                ? 'text-blue-700 dark:text-blue-300'
                                : 'text-gray-600 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400'
                            }`}
            >
              {annotation.data.body.label}
            </div>
          </div>
          <div className="mt-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {t('type')}: {annotation.data?.target?.selector?.type || t('unknown')}
            </span>
          </div>
        </div>

        {/* コンテンツ部分 */}
        <div
          className="text-gray-700 dark:text-gray-300 text-sm pl-9"
          dangerouslySetInnerHTML={{ __html: annotation.data.body.value }}
        />

        {annotation.images && annotation.images.length > 0 && (
          <div
            className="mt-3 pl-9"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
              {t('images')}
            </div>
            <AnnotationImages images={annotation.images} />
          </div>
        )}

        {annotation.tags && annotation.tags.length > 0 && (
          <div className="mt-3 pl-9 flex flex-wrap gap-1.5">
            {annotation.tags.map((tag, i) => (
              <span
                key={i}
                className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200"
              >
                {tagKey(tag)}
              </span>
            ))}
          </div>
        )}

        {annotation.creator && (
          <div className="mt-2 pl-9 text-xs text-gray-500 dark:text-gray-400">
            {t('creator')}: {annotation.creator}
          </div>
        )}

        {annotation.seeAlso && annotation.seeAlso.length > 0 && (
          <div
            className="mt-3 pl-9 text-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
              {t('seeAlso')}
            </div>
            <SeeAlso seeAlso={annotation.seeAlso as unknown as PrimitivesExternalWebResource[]} />
          </div>
        )}

        {/* アクションボタン */}
        {/*
        <div className="mt-3 pl-9 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button className="text-xs text-blue-500 hover:text-blue-600 font-medium">
            詳細を見る
          </button>
        </div>
        */}
      </div>
    </div>
  );

  return (
    <div className="p-6 bg-white dark:bg-gray-900">
      <h2 className="text-xl font-bold mb-6 text-gray-800 dark:text-gray-100">
        {t('annotations')}
      </h2>
      <input
        type="search"
        value={filter.query}
        onChange={(e) => setFilter((f) => ({ ...f, query: e.target.value }))}
        placeholder={t('searchPlaceholder')}
        aria-label={t('searchPlaceholder')}
        className="w-full mb-3 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100"
      />
      {renderFacet('creators', t('creator'), creators)}
      {renderFacet('tags', t('tags'), tags)}
      <div className="mb-4 flex items-center gap-3 text-gray-500 dark:text-gray-400">
        {isFilterActive(filter)
          ? t('filteredCount', { shown: visibleAnnotations.length, total: annotations.length })
          : t('annotationCount', { count: annotations.length })}
        {isFilterActive(filter) && (
          <button
            type="button"
            onClick={() => setFilter(EMPTY_FILTER)}
            className="text-xs text-[var(--ds-primary)] hover:underline"
          >
            {t('clearFilter')}
          </button>
        )}
      </div>
      <div className="space-y-4">
        {regionGroups.map((group) =>
          group.annotations.length > 1 ? (
            <div
              key={group.key}
              className="rounded-lg border border-dashed border-blue-300 dark:border-blue-700 p-2 space-y-2"
            >
              <div className="px-2 text-xs text-blue-700 dark:text-blue-300">
                {t('sameRegion', { count: group.annotations.length })}
              </div>
              {group.annotations.map(renderCard)}
            </div>
          ) : (
            renderCard(group.annotations[0])
          ),
        )}
      </div>
    </div>
  );
}
