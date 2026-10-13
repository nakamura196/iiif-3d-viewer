'use client';

import { lazy, Suspense, useEffect, useMemo } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { chosenUrl, paintedModelsOf, parseManifestV4, sceneOf } from '../../core';
import {
  annotationsAtom,
  modelChoicesAtom,
  paintedModelsAtom,
  sceneIdAtom,
  selectedAnnotationIdAtom,
  showAnnotationsAtom,
} from '../atoms';
import { useTranslations } from '../env';
import ModelChoice from '../three/ModelChoice';
import type { Display, DisplayProps } from './types';

// three.js and react-three-fiber are only fetched when a Scene is shown.
const CanvasComponent = lazy(() => import('../three/Canvas'));

function SceneDisplay({ container, manifest, iiifContent, renderActions, selectedIndex }: DisplayProps) {
  const t = useTranslations('Viewer');
  const paintedModels = useAtomValue(paintedModelsAtom);
  const setPaintedModels = useSetAtom(paintedModelsAtom);
  const setAnnotations = useSetAtom(annotationsAtom);
  const setSceneId = useSetAtom(sceneIdAtom);
  const setSelectedAnnotation = useSetAtom(selectedAnnotationIdAtom);
  const modelChoices = useAtomValue(modelChoicesAtom);
  const [showAnnotations, setShowAnnotations] = useAtom(showAnnotationsAtom);

  // The 3D display reads the Scene that is shown (not always the first one): its models,
  // its notes, and (through sceneIdAtom) its default Camera and Camera buttons.
  const sceneId = container.id;
  useEffect(() => {
    setSceneId(sceneId);
    setPaintedModels(paintedModelsOf(sceneOf(manifest, sceneId)));
    setAnnotations(parseManifestV4(manifest, sceneId).annotations);
    setSelectedAnnotation(null);
  }, [manifest, sceneId, setSceneId, setPaintedModels, setAnnotations, setSelectedAnnotation]);

  // The first painted model is the main one (framing, annotation occlusion);
  // the others are drawn alongside. A Choice shows its chosen (default: first) Model.
  const glbUrl = paintedModels[0] ? chosenUrl(paintedModels[0], modelChoices) : null;
  const extraModels = useMemo(
    () => paintedModels.slice(1).map((m) => ({ url: chosenUrl(m, modelChoices), position: m.position })),
    [paintedModels, modelChoices],
  );
  const hasChoices = (paintedModels[0]?.options.length ?? 0) > 1;

  return (
    <div className="relative flex-1 min-h-0 min-w-0">
      {glbUrl && (
        <Suspense fallback={<div className="p-4 text-sm text-[var(--ds-fg)]">{t('loading')}</div>}>
          {/* a new 3D view per Scene, so that the camera starts again from that Scene's view */}
          <CanvasComponent key={sceneId} glbUrl={glbUrl} extraModels={extraModels} />
        </Suspense>
      )}
      <div className="absolute bottom-4 left-4 z-10 flex items-end gap-2">
        <ModelChoice />
        {renderActions?.({ iiifContent, hasChoices, selectedIndex })}
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
    </div>
  );
}

export const sceneDisplay: Display = {
  id: 'scene',
  match: (c) => c.kind === 'Scene',
  Component: SceneDisplay,
};
