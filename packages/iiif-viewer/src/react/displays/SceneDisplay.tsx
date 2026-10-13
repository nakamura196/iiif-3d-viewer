'use client';

import { lazy, Suspense, useEffect, useMemo } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { chosenUrl, paintedModelsOf, type SceneV4 } from '../../core';
import { modelChoicesAtom, paintedModelsAtom } from '../atoms';
import { useTranslations } from '../env';
import ModelChoice from '../three/ModelChoice';
import type { Display, DisplayProps } from './types';

// three.js and react-three-fiber are only fetched when a Scene is shown.
const CanvasComponent = lazy(() => import('../three/Canvas'));

function SceneDisplay({ container, manifest, iiifContent, renderActions, selectedIndex }: DisplayProps) {
  const t = useTranslations('Viewer');
  const paintedModels = useAtomValue(paintedModelsAtom);
  const setPaintedModels = useSetAtom(paintedModelsAtom);
  const modelChoices = useAtomValue(modelChoicesAtom);

  // The 3D display reads the models of the Scene that is shown (not always the first one).
  const sceneId = container.id;
  useEffect(() => {
    const scene = (manifest.items ?? []).find((c) => (c as { id?: string }).id === sceneId);
    setPaintedModels(paintedModelsOf(scene as unknown as SceneV4 | undefined));
  }, [manifest, sceneId, setPaintedModels]);

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
          <CanvasComponent glbUrl={glbUrl} extraModels={extraModels} />
        </Suspense>
      )}
      <div className="absolute bottom-4 left-4 z-10 flex items-end gap-2">
        <ModelChoice />
        {renderActions?.({ iiifContent, hasChoices, selectedIndex })}
      </div>
    </div>
  );
}

export const sceneDisplay: Display = {
  id: 'scene',
  match: (c) => c.kind === 'Scene',
  Component: SceneDisplay,
};
