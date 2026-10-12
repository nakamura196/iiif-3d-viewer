'use client';

import type { NextPage } from 'next';
import { Suspense } from 'react';
import {
  annotationsAtom,
  manifestUrlAtom,
  modelChoicesAtom,
  paintedModelsAtom,
  showAnnotationsAtom,
} from '@/atoms/infoPanelAtom';
import { useAtom } from 'jotai';
import { useEffect, useMemo, useState } from 'react';
import Info from '@/components/layout/panels/Info';
import SidePanel from '@/components/layout/SidePanel';
import { fetchManifest } from '@nakamura196/iiif-viewer/core';
import { manifestAtom } from '@/atoms/infoPanelAtom';
import CanvasComponent from '@/components/three/Canvas';
import ManifestInput from '@/components/Input';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { convertToV4 } from '@nakamura196/iiif-viewer/core';
import { parseManifestV4 } from '@nakamura196/iiif-viewer/core';
import { chosenUrl, firstSceneOf, paintedModelsOf } from '@nakamura196/iiif-viewer/core';
import ModelChoice from '@/components/three/ModelChoice';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';

const ViewerContent: NextPage = () => {
  const [manifestUrl, setManifestUrl] = useAtom(manifestUrlAtom);
  const [, setManifest] = useAtom(manifestAtom);
  const [paintedModels, setPaintedModels] = useAtom(paintedModelsAtom);
  const [modelChoices, setModelChoices] = useAtom(modelChoicesAtom);
  const [, setLayout] = useState<'horizontal' | 'vertical'>('horizontal');
  const [, setViewerHeight] = useState('100vh');
  const [, setAnnotations] = useAtom(annotationsAtom);
  const [showAnnotations, setShowAnnotations] = useAtom(showAnnotationsAtom);
  const t = useTranslations('Viewer');
  const tc = useTranslations('Compare');
  
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const manifestParam = params.get('manifest');
    if (!manifestParam) return;
    setManifestUrl(manifestParam);
  }, [setManifestUrl]);

  useEffect(() => {
    if (!manifestUrl) return;

    fetchManifest(manifestUrl).then((raw) => {
      if (!raw) return;
      const manifest = convertToV4(raw);
      const { annotations } = parseManifestV4(manifest);
      setPaintedModels(paintedModelsOf(firstSceneOf(manifest)));
      setModelChoices({});
      setManifest(manifest);
      setAnnotations(annotations);
    });
  }, [manifestUrl, setManifest, setAnnotations, setPaintedModels, setModelChoices]);

  // The first painted model is the main one (framing, annotation occlusion);
  // the others are drawn alongside. A Choice shows its chosen (default: first) Model.
  const glbUrl = paintedModels[0] ? chosenUrl(paintedModels[0], modelChoices) : null;
  const extraModels = useMemo(
    () => paintedModels.slice(1).map((m) => ({ url: chosenUrl(m, modelChoices), position: m.position })),
    [paintedModels, modelChoices],
  );

  // ウィンドウサイズとデバイスに応じてレイアウトを変更
  useEffect(() => {
    const handleResize = () => {
      // レイアウトの設定
      setLayout(window.innerWidth < 768 ? 'vertical' : 'horizontal');

      // モバイルデバイスでのビューポートの高さ調整
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);

      // ビューワーの高さ調整
      if (window.innerWidth < 768) {
        setViewerHeight(`${window.innerHeight * 0.6}px`);
      } else {
        setViewerHeight('100vh');
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleManifestSubmit = async (manifestUrl: string) => {
    setManifestUrl(manifestUrl);
  };

  return (
    <>
      <div className="flex flex-col h-screen">
        <Header />
        <main className="flex-1 flex overflow-hidden">
          {manifestUrl ? (
            <div className="flex flex-col sm:flex-row w-full">
              <div className="flex-1 min-h-0 min-w-0 sm:h-full relative bg-gray-100 dark:bg-gray-900">
                {glbUrl && <CanvasComponent glbUrl={glbUrl} extraModels={extraModels} />}
                <div className="absolute bottom-4 left-4 z-10 flex items-end gap-2">
                  <ModelChoice />
                  {/* 候補が 2 つ以上あれば、2 つを並べて見比べるページへ */}
                  {paintedModels[0]?.options.length > 1 && (
                    <Link
                      href={`/compare?manifest=${encodeURIComponent(manifestUrl)}`}
                      className="text-sm px-3 py-1.5 bg-[var(--ds-surface)] rounded-lg shadow-md border border-[var(--ds-border)] text-[var(--ds-fg)] hover:bg-[var(--ds-surface-2)]"
                    >
                      {tc('open')}
                    </Link>
                  )}
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
              <SidePanel className="bg-[var(--ds-surface)] shadow-lg overflow-y-auto border-t sm:border-t-0 sm:border-l border-[var(--ds-border)]">
                <Suspense
                  fallback={
                    <div className="p-6 animate-pulse">
                      <div className="h-6 w-48 bg-[var(--ds-surface-2)] rounded mb-6"></div>
                      <div className="space-y-4">
                        {[...Array(3)].map((_, i) => (
                          <div key={i} className="h-20 bg-[var(--ds-surface-2)] rounded"></div>
                        ))}
                      </div>
                    </div>
                  }
                >
                  <Info />
                </Suspense>
              </SidePanel>
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ManifestInput onSubmit={handleManifestSubmit} />
            </div>
          )}
        </main>
        {!manifestUrl && <Footer />}
      </div>
    </>
  );
};

export default ViewerContent;