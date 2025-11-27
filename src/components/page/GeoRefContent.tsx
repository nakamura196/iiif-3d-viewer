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

interface GeoFeature {
  type: 'Feature';
  metadata: {
    label: string;
    description?: string;
    id: string;
  };
  geometry: {
    coordinates: [number, number];
    type: 'Point';
  };
  properties: {
    resourceCoords: [number, number, number];
  };
}

const GeoRefContent: NextPage = () => {
  const [manifestUrl, setManifestUrl] = useAtom(manifestUrlAtom);
  const [, setManifest] = useAtom(manifestAtom);
  const [glbUrl, setGlbUrl] = useState<string | null>(null);
  const [, setAnnotations] = useAtom(annotationsAtom);
  const [selectedAnnotationId, setSelectedAnnotationId] = useAtom(selectedAnnotationIdAtom);
  const [geoFeatures, setGeoFeatures] = useState<GeoFeature[]>([]);
  const annotationRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

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
      geoFeaturesTemp.forEach((feature) => {
        const coords = feature.properties.resourceCoords;
        annotations.push({
          id: feature.metadata.id,
          creator: '',
          title: feature.metadata.label,
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
              label: feature.metadata.label,
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
  }, [manifestUrl, setManifest, setAnnotations]);

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
                Map
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
                3D
              </div>
              {glbUrl && (
                <Suspense
                  fallback={
                    <div className="flex items-center justify-center h-full">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                    </div>
                  }
                >
                  <CanvasComponent glbUrl={glbUrl} />
                </Suspense>
              )}
            </div>
            {/* Annotations */}
            <div className="h-[40%] lg:h-full lg:w-64 lg:flex-none relative bg-white dark:bg-gray-800 overflow-y-auto">
              <div className="sticky top-0 bg-white dark:bg-gray-800 px-4 py-3 border-b border-gray-200 dark:border-gray-700 z-10">
                <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Annotations ({geoFeatures.length})
                </h2>
              </div>
              <div className="p-4 space-y-2">
                {geoFeatures.map((feature, index) => (
                  <button
                    key={feature.metadata.id}
                    ref={(el) => {
                      if (el) {
                        annotationRefs.current.set(feature.metadata.id, el);
                      }
                    }}
                    onClick={() => handleFeatureClick(feature.metadata.id)}
                    className={`
                      w-full px-4 py-3 rounded-lg text-sm text-left transition-colors
                      ${selectedAnnotationId === feature.metadata.id
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }
                    `}
                  >
                    <div className="flex items-start">
                      <span className="text-xs opacity-70 mr-2 mt-0.5">{index + 1}.</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{feature.metadata.label}</div>
                        {feature.metadata.description && (
                          <div className={`text-xs mt-0.5 truncate ${
                            selectedAnnotationId === feature.metadata.id
                              ? 'text-blue-100'
                              : 'text-gray-500 dark:text-gray-400'
                          }`}>
                            {feature.metadata.description}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
                {geoFeatures.length === 0 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                    No annotations
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
