'use client';

import type { NextPage } from 'next';
import { Suspense } from 'react';
import { annotationsAtom, manifestUrlAtom, selectedAnnotationIdAtom } from '@/atoms/infoPanelAtom';
import { useAtom } from 'jotai';
import { useEffect, useState, useRef } from 'react';
import { fetchManifest } from '@/lib/services/utils';
import { manifestAtom } from '@/atoms/infoPanelAtom';
import CanvasComponent from '@/components/three/Canvas';
import ManifestInput from '@/components/Input';
import Header from '@/components/Header';
import MapView from '@/components/map/MapView';
import { convertToV4 } from '@/lib/services/manifestConverter';
import { parseManifestV4, geoAnnotations, type GeoFeature } from '@/lib/services/manifestParser';
import AnnotationCard from '@/components/annotation/AnnotationCard';
import { useTranslations, useLocale } from 'next-intl';

// マニフェストからattributionを取得するヘルパー関数
const getAttribution = (manifest: Record<string, unknown>, locale: string): string | undefined => {
  const requiredStatement = manifest.requiredStatement as {
    value?: Record<string, string[]>;
  } | undefined;
  if (!requiredStatement?.value) return undefined;
  const value = requiredStatement.value;
  return value[locale]?.[0] || value['en']?.[0] || value['none']?.[0] || Object.values(value)[0]?.[0];
};

const GeoRefContent: NextPage = () => {
  const t = useTranslations('GeoRef');
  const locale = useLocale();
  const [manifestUrl, setManifestUrl] = useAtom(manifestUrlAtom);
  const [, setManifest] = useAtom(manifestAtom);
  const [glbUrl, setGlbUrl] = useState<string | null>(null);
  const [attribution, setAttribution] = useState<string | undefined>(undefined);
  const [annotations, setAnnotations] = useAtom(annotationsAtom);
  const [selectedAnnotationId, setSelectedAnnotationId] = useAtom(selectedAnnotationIdAtom);
  const [geoFeatures, setGeoFeatures] = useState<GeoFeature[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const annotationRefs = useRef<Map<string, HTMLDivElement>>(new Map());

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
      const { modelUrl, geoFeatures, annotations } = parseManifestV4(manifest);
      setGlbUrl(modelUrl);
      setManifest(manifest);
      setAttribution(getAttribution(manifest as unknown as Record<string, unknown>, locale));
      setAnnotations(geoAnnotations(geoFeatures, annotations));
      setGeoFeatures(geoFeatures);
    });
  }, [manifestUrl, setManifest, setAnnotations, locale]);

  const handleManifestSubmit = async (manifestUrl: string) => {
    setManifestUrl(manifestUrl);
  };

  const handleFeatureClick = (id: string) => {
    setSelectedAnnotationId(id);
  };

  // 選択されたアノテーションにスクロール
  useEffect(() => {
    if (selectedAnnotationId) {
      const element = annotationRefs.current.get(selectedAnnotationId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [selectedAnnotationId]);

  return (
    <div className="flex flex-col h-screen">
      <Header />
      <main className="flex-1 flex overflow-hidden">
        {manifestUrl ? (
          <div className="flex flex-col lg:flex-row w-full h-full">
            {/* Map */}
            <div className="h-[30%] lg:h-full lg:flex-[2] relative border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-gray-700">
              <div className="absolute top-4 left-4 z-10 bg-white dark:bg-gray-800 px-3 py-1 rounded-full shadow text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('map')}
              </div>
              <MapView
                features={geoFeatures}
                selectedId={selectedAnnotationId}
                onFeatureClick={handleFeatureClick}
              />
            </div>
            {/* 3D Viewer */}
            <div className="h-[30%] lg:h-full lg:flex-[2] relative bg-gray-100 dark:bg-gray-900 border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-gray-700">
              <div className="absolute top-4 left-4 z-10 bg-white dark:bg-gray-800 px-3 py-1 rounded-full shadow text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('viewer3d')}
              </div>
              {glbUrl && (
                <Suspense
                  fallback={
                    <div className="flex items-center justify-center h-full">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                    </div>
                  }
                >
                  <CanvasComponent glbUrl={glbUrl} attribution={attribution} />
                </Suspense>
              )}
            </div>
            {/* Annotations */}
            <div className="h-[40%] lg:h-full lg:w-96 lg:flex-none relative bg-white dark:bg-gray-800 flex flex-col">
              <div className="sticky top-0 bg-white dark:bg-gray-800 px-4 py-3 border-b border-gray-200 dark:border-gray-700 z-10">
                <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('annotations')} ({geoFeatures.length})
                </h2>
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('searchPlaceholder')}
                    className="w-full px-3 py-1.5 pl-8 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <svg
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {geoFeatures
                  .map((feature, index) => ({ feature, index })) // 番号と注記は絞り込む前の並びで引く
                  .filter(({ feature }) => {
                    const query = searchQuery.toLowerCase();
                    // Search in title
                    if (feature.properties.title.toLowerCase().includes(query)) return true;
                    // Search in names array
                    if (feature.names?.some(name => name.toponym.toLowerCase().includes(query))) return true;
                    return false;
                  })
                  .map(({ feature, index }) => {
                    // 中身（説明・画像・タグ・参照）は 3D の画面の一覧と同じカードで出す
                    const annotation = annotations[index];
                    if (!annotation) return null;
                    const wikipediaLink = feature.links?.find(link => link.type === 'primaryTopicOf')?.identifier;
                    const altNames = feature.names?.filter(name => name.toponym !== feature.properties.title);
                    return (
                      <AnnotationCard
                        key={annotation.id}
                        annotation={annotation}
                        number={index + 1}
                        selected={selectedAnnotationId === annotation.id}
                        onSelect={handleFeatureClick}
                        cardRef={(el) => {
                          if (el) annotationRefs.current.set(annotation.id, el);
                        }}
                      >
                        {/* 地名の別名と Wikipedia は、georef の地物（Linked Places 形式）だけが持つ */}
                        {altNames && altNames.length > 0 && (
                          <div className="mt-2 pl-9 text-xs text-gray-500 dark:text-gray-400">
                            {altNames.map(n => n.toponym).join(', ')}
                          </div>
                        )}
                        {wikipediaLink && (
                          <div className="mt-1 pl-9">
                            <a
                              href={wikipediaLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs text-blue-500 dark:text-blue-400 hover:underline"
                            >
                              Wikipedia
                            </a>
                          </div>
                        )}
                      </AnnotationCard>
                    );
                  })}
                {geoFeatures.length === 0 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                    {t('noAnnotations')}
                  </p>
                )}
                {geoFeatures.length > 0 && searchQuery && geoFeatures.filter((feature) => {
                  const query = searchQuery.toLowerCase();
                  if (feature.properties.title.toLowerCase().includes(query)) return true;
                  if (feature.names?.some(name => name.toponym.toLowerCase().includes(query))) return true;
                  return false;
                }).length === 0 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                    {t('noResults')}
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ManifestInput onSubmit={handleManifestSubmit} />
          </div>
        )}
      </main>
    </div>
  );
};

export default GeoRefContent;
