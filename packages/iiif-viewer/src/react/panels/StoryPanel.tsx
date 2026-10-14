'use client';

import { atom, useAtom, useSetAtom } from 'jotai';
import { useEffect, useMemo, useRef } from 'react';
import {
  chapterLabel,
  containersOf,
  sanitizeAnnotationHtml,
  stepTarget,
  stepText,
  storyOf,
  type AnnotationBodyItem,
  type Story,
  type StoryStep,
} from '../../core';
import { navRequestAtom, nextSeq } from '../displays/structureState';
import { useLocale, useTranslations } from '../env';
import { selectedCanvasAnnotationAtom } from '../overlays/canvasAnnotationState';
import { storyFrameAtom, storyOpenAtom } from '../overlays/storyState';
import type { Panel, PanelContext } from './types';

/** The step being read (index into the story's steps). Viewer に 1 つ（jotai store ごと）。 */
const storyStepAtom = atom<number>(0);

function Text({ body, large }: { body: AnnotationBodyItem; large?: boolean }) {
  const size = large ? 'text-base leading-relaxed' : 'text-sm';
  if (/html/i.test(body.format ?? '')) {
    return (
      <div
        className={`${size} text-[var(--ds-fg)] break-words [&_a]:text-blue-600 [&_a]:underline [&_img]:max-w-full [&_p]:my-2`}
        lang={body.language}
        // サニタイズ済み（許可したタグ・属性だけ）
        dangerouslySetInnerHTML={{ __html: sanitizeAnnotationHtml(body.value ?? '') }}
      />
    );
  }
  return (
    <p className={`${size} text-[var(--ds-fg)] whitespace-pre-wrap break-words`} lang={body.language}>
      {body.value}
    </p>
  );
}

const summaryOf = (step: StoryStep, locale: string): string => {
  const { heading, bodies } = stepText(step, locale);
  if (heading) return heading;
  const first = bodies[0]?.value ?? '';
  return first.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
};

// ストーリー（ガイドツアー）: 説明の注釈を順に送り、その領域に寄って本文を読む。読み取りは core/features/story.ts。
function StoryPanel({ manifest }: PanelContext) {
  const t = useTranslations('Story');
  const locale = useLocale();
  const story = useMemo(() => storyOf(manifest, locale), [manifest, locale]);
  const [index, setIndex] = useAtom(storyStepAtom);
  const [selected, setSelected] = useAtom(selectedCanvasAnnotationAtom);
  const setRequest = useSetAtom(navRequestAtom);
  const current = useRef<HTMLLIElement>(null);
  const setOpen = useSetAtom(storyOpenAtom);
  const [frame, setFrame] = useAtom(storyFrameAtom);

  // while this tab is shown, the annotation marks on the picture step back (see AnnotationOverlay)
  useEffect(() => {
    setOpen(true);
    return () => setOpen(false);
  }, [setOpen]);

  const sizes = useMemo(() => {
    const m = new Map<string, { width?: number; height?: number }>();
    for (const c of containersOf(manifest)) m.set(c.id, { width: c.width, height: c.height });
    return m;
  }, [manifest]);

  // a mark chosen on the picture: follow it when it is a step (no move)
  useEffect(() => {
    if (!story || !selected) return;
    const i = story.steps.findIndex((s) => s.id === selected);
    if (i >= 0) setIndex(i);
  }, [selected, story, setIndex]);

  useEffect(() => {
    current.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [index]);

  if (!story) return null;
  const total = story.steps.length;
  const at = Math.min(Math.max(index, 0), total - 1);
  const step = story.steps[at];

  const go = (i: number) => {
    const s = story.steps[i];
    if (!s) return;
    setIndex(i);
    setSelected(s.id);
    setRequest({ seq: nextSeq(), target: stepTarget(s, sizes.get(s.canvasId)) });
  };
  const whole = () => {
    setSelected(null);
    setRequest({ seq: nextSeq(), target: { canvasId: step.canvasId, xywh: wholeOf(sizes.get(step.canvasId)) } });
  };

  const { heading, bodies } = stepText(step, locale);
  const chapter = story.chapters.find((c) => c.steps.includes(at));

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="px-3 py-1 rounded border border-[var(--ds-border)] text-sm disabled:opacity-40"
          onClick={() => go(at - 1)}
          disabled={at <= 0}
        >
          ← {t('prev')}
        </button>
        <span className="text-sm tabular-nums text-[var(--ds-fg)] opacity-70" aria-live="polite">
          {t('position', { n: at + 1, total })}
        </span>
        <button
          type="button"
          className="px-3 py-1 rounded border border-[var(--ds-border)] text-sm disabled:opacity-40"
          onClick={() => go(at + 1)}
          disabled={at >= total - 1}
        >
          {t('next')} →
        </button>
        <button type="button" className="ml-auto text-xs underline text-[var(--ds-fg)] opacity-70" onClick={whole}>
          {t('whole')}
        </button>
      </div>
      <label className="flex items-center gap-2 text-xs text-[var(--ds-fg)] opacity-80">
        <input type="checkbox" checked={frame} onChange={(e) => setFrame(e.target.checked)} />
        {t('frame')}
      </label>

      <article className="rounded border border-[var(--ds-border)] p-3 space-y-2">
        {chapter && chapter.headStep !== at && chapterLabel(chapter, locale) ? (
          <p className="text-xs text-[var(--ds-fg)] opacity-70">{chapterLabel(chapter, locale)}</p>
        ) : null}
        {heading ? <h3 className="text-lg font-semibold text-[var(--ds-fg)]">{heading}</h3> : null}
        {bodies.map((b, i) => (
          <Text key={i} body={b} large />
        ))}
      </article>

      <nav aria-label={t('steps')}>
        <StepList story={story} at={at} locale={locale} onGo={go} currentRef={current} label={(n) => t('step', { n })} />
      </nav>
    </div>
  );
}

const wholeOf = (size?: { width?: number; height?: number }): [number, number, number, number] | undefined =>
  size?.width && size?.height ? [0, 0, size.width, size.height] : undefined;

function StepList({
  story,
  at,
  locale,
  onGo,
  currentRef,
  label,
}: {
  story: Story;
  at: number;
  locale: string;
  onGo: (i: number) => void;
  currentRef: React.RefObject<HTMLLIElement | null>;
  label: (n: number) => string;
}) {
  const item = (i: number, indent: boolean) => (
    <li key={story.steps[i].id} ref={i === at ? currentRef : undefined}>
      <button
        type="button"
        onClick={() => onGo(i)}
        aria-current={i === at || undefined}
        className={`w-full text-left text-sm rounded px-2 py-1 ${indent ? 'pl-5' : ''} ${
          i === at ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'hover:bg-gray-50 dark:hover:bg-gray-800 text-[var(--ds-fg)]'
        }`}
      >
        <span className="line-clamp-2">{summaryOf(story.steps[i], locale) || label(i + 1)}</span>
      </button>
    </li>
  );

  if (story.chapters.length === 0) return <ol className="space-y-0.5">{story.steps.map((_, i) => item(i, false))}</ol>;

  const grouped = new Set(story.chapters.flatMap((c) => c.steps));
  return (
    <ol className="space-y-2">
      {story.chapters.map((c) => (
        <li key={c.id}>
          {c.headStep === undefined && chapterLabel(c, locale) ? (
            <p className="text-xs font-medium text-[var(--ds-fg)] opacity-70 px-2">{chapterLabel(c, locale)}</p>
          ) : null}
          <ol className="space-y-0.5">{c.steps.map((i) => item(i, c.headStep !== undefined ? i !== c.headStep : false))}</ol>
        </li>
      ))}
      {story.steps.map((_, i) => i).filter((i) => !grouped.has(i)).map((i) => item(i, false))}
    </ol>
  );
}

export const storyPanel: Panel = {
  id: 'story',
  // 資料情報（10）の次。開いてすぐ読み始められるように
  order: 15,
  available: ({ manifest }) => storyOf(manifest) !== null,
  Component: StoryPanel,
};
