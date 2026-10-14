'use client';

import { useAtom } from 'jotai';
import { useEffect, useRef } from 'react';
import {
  annotationSourcesOf,
  containersOf,
  embeddedCanvasAnnotations,
  rawCanvasOf,
  labelIn,
  pickBodies,
  sanitizeAnnotationHtml,
  type AnnotationBodyItem,
  type CanvasAnnotation,
  type StyleDeclarations,
} from '../../core';
import { useLocale, useTranslations } from '../env';
import { useCanvasNavigation } from '../navigation';
import { selectedCanvasAnnotationAtom } from '../overlays/canvasAnnotationState';
import { useCanvasAnnotations } from '../overlays/useCanvasAnnotations';
import type { Panel, PanelContext } from './types';

const KNOWN_MOTIVATIONS = new Set([
  'commenting', 'tagging', 'linking', 'describing', 'identifying', 'classifying',
  'bookmarking', 'highlighting', 'questioning', 'replying', 'editing', 'moderating', 'painting',
]);

const isHtml = (b: AnnotationBodyItem) => /html/i.test(b.format ?? '');

export function Body({ body, canvasLabels }: { body: AnnotationBodyItem; canvasLabels: Map<string, string> }) {
  const t = useTranslations('Info');
  const locale = useLocale();
  const { goToCanvas } = useCanvasNavigation();
  if (body.kind === 'text') {
    if (isHtml(body)) {
      // サニタイズ済み（許可したタグ・属性だけ）
      return (
        <div
          className="text-sm text-gray-800 dark:text-gray-100 break-words [&_a]:text-blue-600 [&_a]:underline [&_img]:max-w-full [&_img]:inline [&_img]:h-5 [&_p]:my-1"
          lang={body.language}
          dangerouslySetInnerHTML={{ __html: sanitizeAnnotationHtml(body.value ?? '') }}
        />
      );
    }
    return (
      <p className="text-sm text-gray-800 dark:text-gray-100 whitespace-pre-wrap break-words" lang={body.language}>
        {body.value}
      </p>
    );
  }
  const url = body.url ?? '';
  const isWeb = /^https?:\/\//i.test(url);
  const own = canvasLabels.get(url);
  const label = labelIn(body.label, locale) || own || url;
  if (own !== undefined) {
    // a Canvas of this item: the button moves the viewer there
    return (
      <button
        type="button"
        className="text-xs text-blue-600 dark:text-blue-400 underline break-words text-left"
        title={t('canvasAnnotationsCanvasLink')}
        onClick={(e) => {
          e.stopPropagation();
          goToCanvas(url);
        }}
      >
        {label}
      </button>
    );
  }
  if (!isWeb) return <p className="text-xs text-gray-500 dark:text-gray-300 break-all">{label}</p>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-xs text-blue-600 dark:text-blue-400 underline break-all"
      title={t('canvasAnnotationsOpen')}
    >
      {label}
    </a>
  );
}

function Item({
  annotation,
  selected,
  onSelect,
  canvasLabels,
  bodyStyle,
}: {
  bodyStyle?: StyleDeclarations;
  annotation: CanvasAnnotation;
  selected: boolean;
  onSelect: () => void;
  canvasLabels: Map<string, string>;
}) {
  const t = useTranslations('Info');
  const locale = useLocale();
  const ref = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selected]);

  const bodies = pickBodies(annotation.bodies, locale);
  const motivation = annotation.painted ? 'painting' : annotation.motivations[0];
  const where =
    annotation.region.type === 'canvas'
      ? t('canvasAnnotationsAbout')
      : annotation.region.type === 'point'
        ? t('canvasAnnotationsPoint')
        : t('canvasAnnotationsRegion');
  return (
    <li
      ref={ref}
      className={`rounded border p-2 cursor-pointer ${
        selected
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
          : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
      }`}
      onClick={onSelect}
      aria-current={selected || undefined}
    >
      <div className="flex gap-2 text-xs text-gray-500 dark:text-gray-300 mb-1">
        {motivation ? (
          <span>
            {KNOWN_MOTIVATIONS.has(motivation) ? t(`canvasAnnotationsMotivation_${motivation}`) : motivation}
          </span>
        ) : null}
        <span>{where}</span>
      </div>
      <div
        className={`space-y-1 ${bodyStyle?.color ? '[&_*]:!text-inherit' : ''}`}
        style={bodyStyle}
      >
        {bodies.map((b, i) => (
          <Body key={i} body={b} canvasLabels={canvasLabels} />
        ))}
      </div>
    </li>
  );
}

export function CanvasAnnotationsPanelBody({ container, manifest }: PanelContext) {
  const t = useTranslations('Info');
  const locale = useLocale();
  const { annotations, loading, failed, styleOf } = useCanvasAnnotations(manifest, container);
  const [selected, setSelected] = useAtom(selectedCanvasAnnotationAtom);

  // clear the selection when the Canvas changes
  useEffect(() => {
    setSelected(null);
  }, [container?.id, setSelected]);

  const canvasLabels = new Map<string, string>();
  containersOf(manifest).forEach((c, i) => canvasLabels.set(c.id, labelIn(c.label, locale) || `Canvas ${i + 1}`));

  // group by AnnotationCollection (annotations of no collection come first)
  const groups = new Map<string, { label: unknown; items: CanvasAnnotation[] }>();
  for (const a of annotations) {
    const key = a.collection?.id ?? '';
    const g = groups.get(key) ?? { label: a.collection?.label, items: [] };
    g.items.push(a);
    groups.set(key, g);
  }
  const ordered = [...groups.entries()].sort((a, b) => (a[0] === '' ? -1 : b[0] === '' ? 1 : 0));

  return (
    <div className="p-3 space-y-3">
      {loading ? <p className="text-sm text-gray-500 dark:text-gray-300">{t('canvasAnnotationsLoading')}</p> : null}
      {failed ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {t('canvasAnnotationsFailed')}
        </p>
      ) : null}
      {!loading && annotations.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-300">{t('canvasAnnotationsEmpty')}</p>
      ) : null}
      {ordered.map(([key, g]) => (
        <section key={key}>
          {key ? (
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
              <LabelOf label={g.label} fallback={key} /> ({t('canvasAnnotationsCount', { count: g.items.length })})
            </h3>
          ) : null}
          <ul className="space-y-2">
            {g.items.map((a) => (
              <Item
                key={a.id}
                annotation={a}
                selected={selected === a.id}
                onSelect={() => setSelected(selected === a.id ? null : a.id)}
                canvasLabels={canvasLabels}
                bodyStyle={styleOf(a).body}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function LabelOf({ label, fallback }: { label: unknown; fallback: string }) {
  const locale = useLocale();
  return <>{labelIn(label, locale) || fallback}</>;
}

// Canvas 上の注釈（コメント・タグ・リンクなど）の一覧。3D の Scene では出さない。
export const canvasAnnotationsPanel: Panel = {
  id: 'canvasAnnotations',
  // 書かれている注釈か、取りに行く参照のどちらかがあるときだけ出す
  available: ({ container, manifest }) => {
    if (container?.kind !== 'Canvas') return false;
    if (annotationSourcesOf(rawCanvasOf(manifest, container.id)).references.length > 0) return true;
    return embeddedCanvasAnnotations(manifest, container.id, container).length > 0;
  },
  Component: CanvasAnnotationsPanelBody,
};
