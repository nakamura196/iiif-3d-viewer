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
import type { Annotation } from '@/types/main';
import { useTranslations, useLocale } from 'next-intl';

interface AnnotationPage {
  type?: string;
  items?: IIIFAnnotation[];
}

interface IIIFAnnotation {
  id?: string;
  type?: string;
  motivation?: string;
  body?: {
    value?: string;
    label?: string;
    type?: string;
    features?: GeoFeature[];
  };
  target?: {
    selector?: {
      type?: string;
      value?: number[];
      area?: number[];
      camPos?: number[];
    };
  };
}

interface GeoFeatureName {
  toponym: string;
  lang: string;
  citations?: {
    label: string;
    '@id': string;
  }[];
}

interface GeoFeatureLink {
  type: string;
  identifier: string;
}

interface GeoFeatureDepiction {
  '@id': string;
}

interface GeoFeature {
  '@id': string;
  type: 'Feature';
  geometry: {
    coordinates: [number, number];
    type: 'Point';
  };
  properties: {
    title: string;
    resourceCoords: [number, number, number];
  };
  names?: GeoFeatureName[];
  links?: GeoFeatureLink[];
  depictions?: GeoFeatureDepiction[];
}

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
  const [, setAnnotations] = useAtom(annotationsAtom);
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

    fetchManifest(manifestUrl).then((manifest) => {
      setGlbUrl(manifest.items[0].items[0].items[0].body.id);
      setManifest(manifest);
      setAttribution(getAttribution(manifest as unknown as Record<string, unknown>, locale));

      const annotations: Annotation[] = [];
      const geoFeaturesTemp: GeoFeature[] = [];
      const canvas = manifest.items?.[0];

      // Check canvas.annotations
      if (canvas?.annotations) {
        canvas.annotations.forEach((annotationPage: AnnotationPage) => {
          if (annotationPage.items) {
            annotationPage.items.forEach((annotation: IIIFAnnotation, index: number) => {
              // Handle georeferencing annotation
              if (annotation.motivation === 'georeferencing' && annotation.body?.type === 'FeatureCollection') {
                const features = annotation.body.features || [];
                geoFeaturesTemp.push(...features);
              }
              // Handle regular annotations
              else if (annotation.body && annotation.target?.selector) {
                const selector = annotation.target.selector;
                annotations.push({
                  id: annotation.id || `annotation-${index}`,
                  creator: '',
                  title: annotation.body.label || '',
                  description: annotation.body.value || '',
                  media: [],
                  wikidata: [],
                  bibliography: [],
                  position: {
                    x: selector.value?.[0] || 0,
                    y: selector.value?.[1] || 0,
                    z: selector.value?.[2] || 0,
                  },
                  data: {
                    body: {
                      value: annotation.body.value || '',
                      label: annotation.body.label || '',
                    },
                    target: {
                      selector: {
                        type: selector.type || '3DSelector',
                        value: (selector.value || [0, 0, 0]) as [number, number, number],
                        area: (selector.area || [0, 0, 0]) as [number, number, number],
                        camPos: (selector.camPos || [0, 0, 0]) as [number, number, number],
                      },
                    },
                  },
                });
              }
            });
          }
        });
      }

      // Also check in items[0].items[0].annotations (alternative location per provided JSON)
      const annotationPage = manifest.items?.[0]?.items?.[0];
      if (annotationPage?.annotations) {
        annotationPage.annotations.forEach((page: AnnotationPage) => {
          if (page.items) {
            page.items.forEach((annotation: IIIFAnnotation, index: number) => {
              // Handle georeferencing annotation
              if (annotation.motivation === 'georeferencing' && annotation.body?.type === 'FeatureCollection') {
                const features = annotation.body.features || [];
                geoFeaturesTemp.push(...features);
              }
              // Handle regular annotations with 3DSelector
              else if (annotation.body && annotation.target?.selector) {
                const selector = annotation.target.selector;
                annotations.push({
                  id: annotation.id || `annotation-${index}`,
                  creator: '',
                  title: annotation.body.label || '',
                  description: annotation.body.value || '',
                  media: [],
                  wikidata: [],
                  bibliography: [],
                  position: {
                    x: selector.value?.[0] || 0,
                    y: selector.value?.[1] || 0,
                    z: selector.value?.[2] || 0,
                  },
                  data: {
                    body: {
                      value: annotation.body.value || '',
                      label: annotation.body.label || '',
                    },
                    target: {
                      selector: {
                        type: selector.type || '3DSelector',
                        value: (selector.value || [0, 0, 0]) as [number, number, number],
                        area: (selector.area || [0, 0, 0]) as [number, number, number],
                        camPos: (selector.camPos || [0, 0, 0]) as [number, number, number],
                      },
                    },
                  },
                });
              }
            });
          }
        });
      }

      // Convert geoFeatures to annotations for 3D viewer
      geoFeaturesTemp.forEach((feature, idx) => {
        const coords = feature.properties.resourceCoords;
        const title = feature.properties.title;
        annotations.push({
          id: feature['@id'] || `geo-feature-${idx}`,
          creator: '',
          title: title,
          description: '',
          media: [],
          wikidata: [],
          bibliography: [],
          position: {
            x: coords[0],
            y: coords[1],
            z: coords[2],
          },
          data: {
            body: {
              value: '',
              label: title,
            },
            target: {
              selector: {
                type: '3DSelector',
                value: coords as [number, number, number],
                area: [0, 0, 0] as [number, number, number],
                camPos: [coords[0] * 1.5, coords[1] * 1.5, coords[2] * 1.5] as [number, number, number],
              },
            },
          },
        });
      });

      setAnnotations(annotations);
      setGeoFeatures(geoFeaturesTemp);
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
            <div className="h-[40%] lg:h-full lg:w-64 lg:flex-none relative bg-white dark:bg-gray-800 flex flex-col">
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
                  .filter((feature) => {
                    const query = searchQuery.toLowerCase();
                    // Search in title
                    if (feature.properties.title.toLowerCase().includes(query)) return true;
                    // Search in names array
                    if (feature.names?.some(name => name.toponym.toLowerCase().includes(query))) return true;
                    return false;
                  })
                  .map((feature, index) => {
                    const thumbnail = feature.depictions?.[0]?.['@id'];
                    const wikipediaLink = feature.links?.find(link => link.type === 'primaryTopicOf')?.identifier;
                    const altNames = feature.names?.filter(name => name.toponym !== feature.properties.title);

                    const featureId = feature['@id'] || `geo-feature-${index}`;
                    return (
                      <div
                        key={featureId}
                        ref={(el) => {
                          if (el) {
                            annotationRefs.current.set(featureId, el);
                          }
                        }}
                        className={`
                          w-full rounded-lg text-sm text-left transition-colors overflow-hidden
                          ${selectedAnnotationId === featureId
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                          }
                        `}
                      >
                        <button
                          onClick={() => handleFeatureClick(featureId)}
                          className="w-full px-4 py-3 text-left"
                        >
                          <div className="flex items-start">
                            {thumbnail ? (
                              <div className="w-10 h-10 flex-shrink-0 mr-3 rounded overflow-hidden bg-gray-200 dark:bg-gray-600">
                                <img
                                  src={thumbnail}
                                  alt={feature.properties.title}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                              </div>
                            ) : (
                              <span className="text-xs opacity-70 mr-2 mt-0.5">{index + 1}.</span>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="font-medium">{feature.properties.title}</div>
                              {altNames && altNames.length > 0 && (
                                <div className={`text-xs mt-0.5 truncate ${
                                  selectedAnnotationId === featureId
                                    ? 'text-blue-100'
                                    : 'text-gray-500 dark:text-gray-400'
                                }`}>
                                  {altNames.map(n => n.toponym).join(', ')}
                                </div>
                              )}
                            </div>
                          </div>
                        </button>
                        {wikipediaLink && (
                          <div className={`px-4 pb-2 ${thumbnail ? 'pl-[68px]' : 'pl-8'}`}>
                            <a
                              href={wikipediaLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className={`inline-flex items-center text-xs hover:underline ${
                                selectedAnnotationId === featureId
                                  ? 'text-blue-100 hover:text-white'
                                  : 'text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300'
                              }`}
                            >
                              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                              Wikipedia
                            </a>
                          </div>
                        )}
                      </div>
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
