'use client';

import type { NextPage } from 'next';
import { Suspense } from 'react';
import { annotationsAtom, manifestUrlAtom, selectedAnnotationIdAtom } from '@nakamura196/iiif-viewer';
import { useAtom } from 'jotai';
import { useEffect, useMemo, useState, useRef } from 'react';
import { fetchManifest } from '@nakamura196/iiif-viewer/core';
import { manifestAtom } from '@nakamura196/iiif-viewer';
import { CanvasComponent, GeoImageView, useCanvasImages } from '@nakamura196/iiif-viewer';
import ManifestInput from '@/components/Input';
import Header from '@/components/Header';
import MapView, { type MapImageOverlay } from '@/components/map/MapView';
import { convertToV4 } from '@nakamura196/iiif-viewer/core';
import { parseManifestV4, geoAnnotations, geoFeatureIdOf, overlayCorners, type GeoFeature, type ImageLayer } from '@nakamura196/iiif-viewer/core';
import { AnnotationCard } from '@nakamura196/iiif-viewer';
import { SidePanel } from '@nakamura196/iiif-viewer';
import { useTranslations, useLocale } from 'next-intl';
import { manifestFromParams } from '@nakamura196/iiif-viewer/core';

// マニフェストからattributionを取得するヘルパー関数
const getAttribution = (manifest: Record<string, unknown>, locale: string): string | undefined => {
  const requiredStatement = manifest.requiredStatement as {
    value?: Record<string, string[]>;
  } | undefined;
  if (!requiredStatement?.value) return undefined;
  const value = requiredStatement.value;
  return value[locale]?.[0] || value['en']?.[0] || value['none']?.[0] || Object.values(value)[0]?.[0];
};

// 地図に重ねる画像の URL。Image API があれば、地図に貼るのに足りる大きさ（長辺 4096 px まで）で取る。
// 元の画像は数万 px になることがあり、そのままでは重く、ブラウザの上限も超える
const OVERLAY_MAX = 4096;
const overlayUrlOf = (layer: ImageLayer): string => {
  if (!layer.service) return layer.url;
  const size = Math.min(OVERLAY_MAX, Math.max(layer.width ?? OVERLAY_MAX, layer.height ?? OVERLAY_MAX));
  const quality = layer.service.version === 1 ? 'native' : 'default';
  return `${layer.service.id}/full/!${size},${size}/0/${quality}.jpg`;
};

const GeoRefContent: NextPage = () => {
  const t = useTranslations('GeoRef');
  const locale = useLocale();
  const [manifestUrl, setManifestUrl] = useAtom(manifestUrlAtom);
  const [, setManifest] = useAtom(manifestAtom);
  const [glbUrl, setGlbUrl] = useState<string | null>(null);
  // 地点が画像（絵図・古地図）に付いているときは、その Canvas を 3D の代わりに出す
  const [geoCanvasId, setGeoCanvasId] = useState<string | undefined>(undefined);
  const geoCanvas = useCanvasImages(geoCanvasId ? manifestUrl : null, geoCanvasId);
  const [attribution, setAttribution] = useState<string | undefined>(undefined);
  const [annotations, setAnnotations] = useAtom(annotationsAtom);
  const [selectedAnnotationId, setSelectedAnnotationId] = useAtom(selectedAnnotationIdAtom);
  const [geoFeatures, setGeoFeatures] = useState<GeoFeature[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const annotationRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const manifestParam = manifestFromParams(params);
    if (!manifestParam) return;
    setManifestUrl(manifestParam);
  }, [setManifestUrl]);

  useEffect(() => {
    if (!manifestUrl) return;

    fetchManifest(manifestUrl).then((raw) => {
      if (!raw) return;
      const manifest = convertToV4(raw);
      const { modelUrl, geoFeatures, annotations, geoCanvasId } = parseManifestV4(manifest);
      setGlbUrl(modelUrl);
      setGeoCanvasId(geoCanvasId);
      setManifest(manifest);
      setAttribution(getAttribution(manifest as unknown as Record<string, unknown>, locale));
      setAnnotations(geoAnnotations(geoFeatures, annotations));
      setGeoFeatures(geoFeatures);
    });
  }, [manifestUrl, setManifest, setAnnotations, locale]);

  const handleManifestSubmit = async (manifestUrl: string) => {
    setManifestUrl(manifestUrl);
  };

  const imagePoints = useMemo(
    () =>
      geoFeatures.map((f, idx) => ({
        id: geoFeatureIdOf(f, idx),
        title: f.properties.title,
        x: f.properties.resourceCoords[0],
        y: f.properties.resourceCoords[1],
      })),
    [geoFeatures]
  );

  // 画像を地図に重ねる。対応点から四隅の位置を求める（1 次の多項式、対応点が 3 つ以上のとき）。
  // Canvas に画像が 1 枚だけ全面に貼られている場合に限る（一部に貼った画像や回転は扱わない）
  const mapOverlay = useMemo((): MapImageOverlay | null => {
    const paintings = geoCanvas?.paintings ?? [];
    const layer = paintings.length === 1 ? paintings[0].options[0]?.layer : undefined;
    const width = geoCanvas?.width ?? layer?.width;
    const height = geoCanvas?.height ?? layer?.height;
    if (!layer || layer.target || layer.regionSpec || layer.rotation || layer.mirror || !width || !height) return null;
    const corners = overlayCorners(
      geoFeatures.map((f) => ({
        resource: [f.properties.resourceCoords[0], f.properties.resourceCoords[1]],
        geo: f.geometry.coordinates,
      })),
      width,
      height
    );
    return corners ? { url: overlayUrlOf(layer), corners } : null;
  }, [geoCanvas, geoFeatures]);

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
    <div className="flex flex-col h-dvh">
      <Header />
      <main className="flex-1 flex overflow-hidden">
        {manifestUrl ? (
          <div className="flex flex-col lg:flex-row w-full h-full">
            {/* Map */}
            <div className="flex-1 min-h-0 lg:h-full lg:flex-[2] relative border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-gray-700">
              <div className="absolute top-4 left-4 z-10 bg-white dark:bg-gray-800 px-3 py-1 rounded-full shadow text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('map')}
              </div>
              <MapView
                features={geoFeatures}
                selectedId={selectedAnnotationId}
                onFeatureClick={handleFeatureClick}
                overlay={mapOverlay}
              />
            </div>
            {/* 3D Viewer, or the georeferenced picture */}
            <div className="flex-1 min-h-0 lg:h-full lg:flex-[2] relative bg-gray-100 dark:bg-gray-900 border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-gray-700">
              <div className="absolute top-4 left-4 z-10 bg-white dark:bg-gray-800 px-3 py-1 rounded-full shadow text-sm font-medium text-gray-700 dark:text-gray-300">
                {geoCanvasId ? t('image') : t('viewer3d')}
              </div>
              {geoCanvas && (
                <GeoImageView
                  canvas={geoCanvas}
                  points={imagePoints}
                  selectedId={selectedAnnotationId}
                  onSelect={handleFeatureClick}
                />
              )}
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
            <SidePanel breakpoint="lg" className="bg-white dark:bg-gray-800 flex flex-col">
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
            </SidePanel>
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
