'use client';

import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Provider, createStore, useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
  chosenUrl,
  containersOf,
  labelIn,
  paintedModelsOf,
  type ContainerInfo,
  type MediaOption,
  type SceneV4,
  type SupplementingContent,
} from '../core';
import { manifestAtom, modelChoicesAtom, paintedModelsAtom, showAnnotationsAtom } from './atoms';
import ContainerList from './ContainerList';
import ImageView from './displays/ImageView';
import MediaView, { type CaptionTrack } from './displays/MediaView';
import TranscriptPanel from './displays/TranscriptPanel';
import { ViewerEnv, useLocale, useTranslations, type ResolvedTheme } from './env';
import Info, { type InfoTab } from './layout/panels/Info';
import SidePanel from './layout/SidePanel';
import ModelChoice from './three/ModelChoice';
import { useManifest } from './useManifest';

// three.js and react-three-fiber are only fetched when a Scene is shown.
const CanvasComponent = lazy(() => import('./three/Canvas'));

const isVtt = (s: SupplementingContent) => s.format === 'text/vtt' || /\.vtt(\?|$)/i.test(s.url);
const isCaptions = (s: SupplementingContent) =>
  isVtt(s) && s.provides.some((p) => p === 'closedCaptions' || p === 'subtitles');
const isTranscript = (s: SupplementingContent) =>
  s.provides.includes('transcript') ||
  (s.provides.length === 0 && (s.format === 'text/plain' || isVtt(s)));
const optionLabel = (o: MediaOption, locale: string) =>
  labelIn(o.label, locale) || decodeURIComponent(o.url.split('/').pop() ?? o.url);

export interface ViewerActionsState {
  iiifContent: string;
  /** The main model has two or more candidates (a Choice). */
  hasChoices: boolean;
}

export interface ViewerProps {
  /** URL of the IIIF manifest. */
  iiifContent: string;
  locale?: 'ja' | 'en';
  theme?: 'light' | 'dark' | 'auto';
  /** Controlled side panel tab. Without it the viewer keeps the tab itself. */
  tab?: InfoTab;
  onTabChange?: (tab: InfoTab) => void;
  /** Extra controls placed next to the model choice (bottom left of the 3D view). */
  renderActions?: (state: ViewerActionsState) => ReactNode;
  className?: string;
}

function usePrefersDark(enabled: boolean): boolean {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setDark(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [enabled]);
  return dark;
}

function ViewerBody({
  iiifContent,
  tab,
  onTabChange,
  renderActions,
  className = '',
  dark,
}: Pick<ViewerProps, 'iiifContent' | 'tab' | 'onTabChange' | 'renderActions' | 'className'> & {
  dark: boolean;
}) {
  const t = useTranslations('Viewer');
  const locale = useLocale();
  const manifest = useAtomValue(manifestAtom);
  const paintedModels = useAtomValue(paintedModelsAtom);
  const setPaintedModels = useSetAtom(paintedModelsAtom);
  const [modelChoices, setModelChoices] = useAtom(modelChoicesAtom);
  const [showAnnotations, setShowAnnotations] = useAtom(showAnnotationsAtom);
  const { failed } = useManifest(iiifContent);

  const containers = useMemo(() => containersOf(manifest), [manifest]);
  const [picked, setPicked] = useState<{ content: string; index: number }>({ content: iiifContent, index: 0 });
  const selected = Math.min(picked.content === iiifContent ? picked.index : 0, Math.max(containers.length - 1, 0));
  const container: ContainerInfo | undefined = containers[selected];
  const isScene = container?.kind === 'Scene';

  // The 3D display reads the models of the Scene that is shown (not always the first one).
  const sceneId = isScene ? container.id : null;
  useEffect(() => {
    if (!sceneId) return;
    const scene = (manifest?.items ?? []).find((c) => (c as { id?: string }).id === sceneId);
    setPaintedModels(paintedModelsOf(scene as unknown as SceneV4 | undefined));
  }, [manifest, sceneId, setPaintedModels]);

  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);

  // The first painted model is the main one (framing, annotation occlusion);
  // the others are drawn alongside. A Choice shows its chosen (default: first) Model.
  const glbUrl = isScene && paintedModels[0] ? chosenUrl(paintedModels[0], modelChoices) : null;
  const extraModels = useMemo(
    () => paintedModels.slice(1).map((m) => ({ url: chosenUrl(m, modelChoices), position: m.position })),
    [paintedModels, modelChoices],
  );
  const hasChoices = isScene && (paintedModels[0]?.options.length ?? 0) > 1;

  // Image / Video / Audio: the first painting that has something of those kinds.
  const painting = container?.painting.find((p) => p.options.some((o) => o.kind !== 'Model'));
  const optionIndex = painting ? Math.min(modelChoices[painting.id] ?? 0, painting.options.length - 1) : 0;
  const option = painting?.options[optionIndex];

  const captions: CaptionTrack[] = (container?.supplementing ?? []).filter(isCaptions).map((s) => ({
    url: s.url,
    language: s.language[0],
    label: labelIn(s.label, locale) || s.language[0] || 'captions',
  }));
  const transcript = (container?.supplementing ?? []).find(isTranscript);

  const seek = (seconds: number) => {
    const el = mediaRef.current;
    if (el) el.currentTime = seconds;
    setCurrentTime(seconds);
  };

  let display: ReactNode = null;
  if (failed) {
    display = <div className="p-4 text-sm text-[var(--ds-fg)]" role="alert">{t('manifestError')}</div>;
  } else if (!manifest) {
    display = <div className="p-4 text-sm text-[var(--ds-fg)]">{t('loadingManifest')}</div>;
  } else if (!container) {
    display = <div className="p-4 text-sm text-[var(--ds-fg)]">{t('empty')}</div>;
  } else if (isScene) {
    display = (
      <>
        {glbUrl && (
          <Suspense fallback={<div className="p-4 text-sm text-[var(--ds-fg)]">{t('loading')}</div>}>
            <CanvasComponent glbUrl={glbUrl} extraModels={extraModels} />
          </Suspense>
        )}
        <div className="absolute bottom-4 left-4 z-10 flex items-end gap-2">
          <ModelChoice />
          {renderActions?.({ iiifContent, hasChoices })}
        </div>
        {/* アノテーション表示切替ボタン */}
        <button
          onClick={() => setShowAnnotations(!showAnnotations)}
          className="absolute top-4 left-4 z-10 px-3 py-2 bg-[var(--ds-surface)] rounded-lg shadow-md hover:bg-[var(--ds-surface-2)] transition-colors border border-[var(--ds-border)]"
          title={showAnnotations ? t('hideAnnotations') : t('showAnnotations')}
        >
          <span className="text-sm text-[var(--ds-fg)]">
            {showAnnotations ? t('hideAnnotations') : t('showAnnotations')}
          </span>
        </button>
      </>
    );
  } else if (option?.kind === 'Image') {
    display = <ImageView key={option.url} src={option.url} alt={labelIn(container.label, locale)} />;
  } else if (option?.kind === 'Video' || option?.kind === 'Audio') {
    display = (
      <MediaView
        kind={option.kind}
        src={option.url}
        format={option.format}
        width={option.width}
        height={option.height}
        tracks={captions}
        mediaRef={mediaRef}
        onTimeUpdate={setCurrentTime}
      />
    );
  } else {
    display = <div className="p-4 text-sm text-[var(--ds-fg)]">{t('unsupportedContent')}</div>;
  }

  const showChoiceSelect = !isScene && painting && painting.options.length > 1;

  return (
    <div className={`flex flex-col sm:flex-row w-full ${dark ? 'dark' : ''} ${className}`.trim()}>
      <div className="flex-1 min-h-0 min-w-0 sm:h-full flex flex-col bg-gray-100 dark:bg-gray-900">
        <ContainerList
          containers={containers}
          selected={selected}
          onSelect={(index) => {
            setPicked({ content: iiifContent, index });
            setModelChoices({});
            setCurrentTime(0);
          }}
        />
        {showChoiceSelect && (
          <div className="flex items-center gap-2 p-1.5 bg-[var(--ds-surface)] border-b border-[var(--ds-border)]">
            <label className="text-sm text-[var(--ds-fg)]" htmlFor="iiif-viewer-choice">
              {t('choice')}
            </label>
            <select
              id="iiif-viewer-choice"
              value={optionIndex}
              onChange={(e) => setModelChoices((c) => ({ ...c, [painting.id]: Number(e.target.value) }))}
              className="text-sm rounded border border-[var(--ds-border)] bg-[var(--ds-surface)] text-[var(--ds-fg)] px-1 py-0.5 max-w-full"
            >
              {painting.options.map((o, i) => (
                <option key={o.url} value={i}>
                  {optionLabel(o, locale)}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="relative flex-1 min-h-0 min-w-0">{display}</div>
      </div>
      <SidePanel className="bg-[var(--ds-surface)] shadow-lg overflow-y-auto border-t sm:border-t-0 sm:border-l border-[var(--ds-border)]">
        <Info
          tab={tab}
          onTabChange={onTabChange}
          showAnnotations={isScene}
          transcript={
            transcript ? (
              <TranscriptPanel
                key={transcript.url}
                url={transcript.url}
                format={transcript.format}
                currentTime={currentTime}
                onSeek={seek}
              />
            ) : undefined
          }
        />
      </SidePanel>
    </div>
  );
}

/**
 * The IIIF 3D viewer: 3D view, model choice, annotation toggle, and the side
 * panel (metadata / annotations). It owns its jotai store, so several viewers
 * (or a surrounding app's own store) do not interfere.
 */
export function Viewer({
  iiifContent,
  locale = 'ja',
  theme = 'auto',
  tab,
  onTabChange,
  renderActions,
  className,
}: ViewerProps) {
  const [store] = useState(() => createStore());
  const prefersDark = usePrefersDark(theme === 'auto');
  const resolvedTheme: ResolvedTheme = theme === 'auto' ? (prefersDark ? 'dark' : 'light') : theme;

  return (
    <Provider store={store}>
      <ViewerEnv locale={locale} resolvedTheme={resolvedTheme}>
        <ViewerBody
          iiifContent={iiifContent}
          tab={tab}
          onTabChange={onTabChange}
          renderActions={renderActions}
          className={className}
          dark={resolvedTheme === 'dark'}
        />
      </ViewerEnv>
    </Provider>
  );
}
