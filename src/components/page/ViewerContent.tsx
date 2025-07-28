'use client';

import type { NextPage } from 'next';
import { Suspense } from 'react';
import { annotationsAtom, manifestUrlAtom } from '@/atoms/infoPanelAtom';
import { useAtom } from 'jotai';
import { useEffect, useState } from 'react';
import Info from '@/components/layout/panels/Info';
import { fetchManifest } from '@/lib/services/utils';
import { manifestAtom } from '@/atoms/infoPanelAtom';
import CanvasComponent from '@/components/three/Canvas';
import ManifestInput from '@/components/Input';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const ViewerContent: NextPage = () => {
  const [manifestUrl, setManifestUrl] = useAtom(manifestUrlAtom);
  const [, setManifest] = useAtom(manifestAtom);
  const [glbUrl, setGlbUrl] = useState<string | null>(null);
  const [, setLayout] = useState<'horizontal' | 'vertical'>('horizontal');
  const [, setViewerHeight] = useState('100vh');
  const [, setAnnotations] = useAtom(annotationsAtom);
  
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const manifestParam = params.get('manifest');
    if (!manifestParam) return;
    setManifestUrl(manifestParam);
  }, [setManifestUrl]);

  useEffect(() => {
    if (!manifestUrl) return;

    fetchManifest(manifestUrl).then((manifest) => {
      setGlbUrl(manifest.items[0].items[0].items[0].body.id);
      setManifest(manifest);
    });
  }, [manifestUrl, setManifest, setAnnotations]);

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
              <div className="h-[50vh] sm:h-full sm:w-[70%] relative bg-gray-100 dark:bg-gray-900">
                {glbUrl && <CanvasComponent glbUrl={glbUrl} />}
              </div>
              <div className="flex-1 sm:w-[30%] bg-white shadow-lg overflow-y-auto border-t sm:border-t-0 sm:border-l border-gray-200">
                <Suspense
                  fallback={
                    <div className="p-6 animate-pulse">
                      <div className="h-6 w-48 bg-gray-200 rounded mb-6"></div>
                      <div className="space-y-4">
                        {[...Array(3)].map((_, i) => (
                          <div key={i} className="h-20 bg-gray-200 rounded"></div>
                        ))}
                      </div>
                    </div>
                  }
                >
                  <Info />
                </Suspense>
              </div>
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