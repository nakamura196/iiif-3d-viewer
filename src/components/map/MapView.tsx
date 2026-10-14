'use client';

import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// The worker file is copied to public/ at build time (scripts/copy-maplibre-worker.mjs)
maplibregl.setWorkerUrl(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/maplibre/maplibre-gl-worker.mjs`);
import { useTheme } from 'next-themes';
import { useLocale, useTranslations } from 'next-intl';
import { geoFeatureIdOf, type LngLat } from '@nakamura196/iiif-viewer/core';

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
    resourceCoords: [number, number] | [number, number, number];
  };
  names?: GeoFeatureName[];
  links?: GeoFeatureLink[];
  depictions?: GeoFeatureDepiction[];
}

/** 地図に重ねる画像（絵図・古地図）。corners は左上・右上・右下・左下の経度・緯度。 */
export interface MapImageOverlay {
  url: string;
  corners: LngLat[];
}

interface MapViewProps {
  features: GeoFeature[];
  selectedId: string | null;
  onFeatureClick: (id: string) => void;
  overlay?: MapImageOverlay | null;
}

const OVERLAY_SOURCE = 'georef-overlay';
const OVERLAY_LAYER = 'georef-overlay';

// 「全体を表示」ボタン。手で拡大・移動したあと、すべてのピンが収まる縮尺に戻す。
// 拡大・縮小のボタン（NavigationControl）と同じ見た目の枠に入れる
class FitAllControl implements maplibregl.IControl {
  private container?: HTMLDivElement;
  constructor(private readonly label: string, private readonly onFit: () => void) {}
  onAdd() {
    const container = document.createElement('div');
    container.className = 'maplibregl-ctrl maplibregl-ctrl-group';
    const button = document.createElement('button');
    button.type = 'button';
    button.title = this.label;
    button.setAttribute('aria-label', this.label);
    // 四隅の括弧（全体に合わせる）の印
    button.innerHTML =
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round" style="margin:auto;display:block" aria-hidden="true">' +
      '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
    button.addEventListener('click', this.onFit);
    container.appendChild(button);
    this.container = container;
    return container;
  }
  onRemove() {
    this.container?.remove();
  }
}

export default function MapView({ features, selectedId, onFeatureClick, overlay }: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const activePopupRef = useRef<maplibregl.Popup | null>(null);
  const { resolvedTheme } = useTheme();
  const locale = useLocale();
  const t = useTranslations('GeoRef');
  const mapReadyRef = useRef(false);
  const featuresRef = useRef(features);
  const selectedIdRef = useRef(selectedId);
  const onFeatureClickRef = useRef(onFeatureClick);

  // Refsを最新の値で更新
  featuresRef.current = features;
  selectedIdRef.current = selectedId;
  onFeatureClickRef.current = onFeatureClick;

  // 重ねた画像の表示と濃さ。地図を作り直しても（テーマ・言語の切り替え）引き継ぐ
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [overlayOpacity, setOverlayOpacity] = useState(0.7);
  const overlayRef = useRef(overlay);
  const overlayStateRef = useRef({ visible: overlayVisible, opacity: overlayOpacity });
  overlayRef.current = overlay;
  overlayStateRef.current = { visible: overlayVisible, opacity: overlayOpacity };

  // 画像を地図に貼る。四隅を指定すると、地図ライブラリがその間を埋めて描く。
  // マーカーは地図の上に重なる別の要素なので、画像より常に手前に出る
  const syncOverlay = () => {
    const m = map.current;
    if (!m || !mapReadyRef.current) return;
    const current = overlayRef.current;
    if (m.getLayer(OVERLAY_LAYER)) m.removeLayer(OVERLAY_LAYER);
    if (m.getSource(OVERLAY_SOURCE)) m.removeSource(OVERLAY_SOURCE);
    if (!current) return;
    m.addSource(OVERLAY_SOURCE, {
      type: 'image',
      url: current.url,
      coordinates: current.corners as [LngLat, LngLat, LngLat, LngLat],
    });
    const { visible, opacity } = overlayStateRef.current;
    m.addLayer({
      id: OVERLAY_LAYER,
      type: 'raster',
      source: OVERLAY_SOURCE,
      layout: { visibility: visible ? 'visible' : 'none' },
      paint: { 'raster-opacity': opacity, 'raster-fade-duration': 0 },
    });
  };

  // 言語コードをOpenMapTiles形式に変換
  const getMapLanguage = (loc: string) => {
    switch (loc) {
      case 'ja': return 'ja';
      case 'en': return 'en';
      default: return 'en';
    }
  };

  // マーカーを追加する関数（Refを使用）
  const addMarkersToMap = () => {
    if (!map.current || !mapReadyRef.current) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current.clear();

    const currentFeatures = featuresRef.current;
    const currentSelectedId = selectedIdRef.current;
    const currentOnFeatureClick = onFeatureClickRef.current;

    // Add markers for each feature
    currentFeatures.forEach((feature) => {
      // Web Mercator投影で表示できない座標（緯度±85度超）をスキップ
      const [lng, lat] = feature.geometry.coordinates;
      if (lat > 85 || lat < -85) {
        return;
      }
      const featureId = geoFeatureIdOf(feature, currentFeatures.indexOf(feature));
      const title = feature.properties.title;
      const thumbnail = feature.depictions?.[0]?.['@id'];
      const altNames = feature.names?.filter(n => n.toponym !== title).map(n => n.toponym).join(', ');

      const el = document.createElement('div');
      el.className = 'marker';
      el.style.width = '24px';
      el.style.height = '24px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = featureId === currentSelectedId ? '#ef4444' : '#3b82f6';
      el.style.border = '3px solid white';
      el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
      el.style.cursor = 'pointer';

      const isDark = resolvedTheme === 'dark';
      const thumbnailHtml = thumbnail
        ? `<div style="width: 100%; max-width: 150px; margin-bottom: 8px; border-radius: 4px; overflow: hidden;">
            <img src="${thumbnail}" alt="${title}" style="width: 100%; height: auto; display: block;" onerror="this.parentElement.style.display='none'" />
          </div>`
        : '';
      const altNamesHtml = altNames
        ? `<div style="font-size: 12px; color: ${isDark ? '#9ca3af' : '#6b7280'}; margin-top: 4px;">${altNames}</div>`
        : '';
      const popup = new maplibregl.Popup({
        offset: 25,
        closeButton: false,
        closeOnClick: false,
        className: isDark ? 'dark-popup' : '',
        maxWidth: '200px'
      }).setHTML(
        `<div style="padding: 8px; background-color: ${isDark ? '#1f2937' : '#ffffff'}; color: ${isDark ? '#f3f4f6' : '#111827'}; border-radius: 4px;">
          ${thumbnailHtml}
          <div style="font-weight: bold;">${title}</div>
          ${altNamesHtml}
        </div>`
      );

      el.addEventListener('mouseenter', () => {
        if (activePopupRef.current) {
          activePopupRef.current.remove();
        }
        popup.setLngLat(feature.geometry.coordinates).addTo(map.current!);
        activePopupRef.current = popup;
      });
      el.addEventListener('mouseleave', () => {
        popup.remove();
        if (activePopupRef.current === popup) {
          activePopupRef.current = null;
        }
      });

      el.addEventListener('click', () => {
        popup.remove();
        if (activePopupRef.current === popup) {
          activePopupRef.current = null;
        }
        currentOnFeatureClick(featureId);
      });

      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat(feature.geometry.coordinates)
        .addTo(map.current!);

      markersRef.current.set(featureId, marker);
    });

    fitAll(0);
  };

  // すべてのピンが収まるように合わせる（地球儀なら大陸の規模、街なら通りの規模になる）。
  // ピンが 1 つ・ごく近いときに寄りすぎないよう、上限は建物が見える程度。
  // 開いたときと、「全体を表示」ボタンを押したときに使う
  const fitAll = (duration = 600) => {
    const currentFeatures = featuresRef.current;
    if (!map.current || currentFeatures.length === 0) return;
    const bounds = new maplibregl.LngLatBounds();
    currentFeatures.forEach(f => bounds.extend(f.geometry.coordinates));
    // 画像を重ねているときは、画像の全体も収める
    overlayRef.current?.corners.forEach(c => bounds.extend(c));
    map.current.fitBounds(bounds, { padding: 50, maxZoom: 17, duration });
  };
  const fitAllRef = useRef(fitAll);
  fitAllRef.current = fitAll;

  useEffect(() => {
    if (!mapContainer.current) return;

    const lang = getMapLanguage(locale);

    // 既存のマップを削除
    if (map.current) {
      map.current.remove();
      map.current = null;
    }

    // OpenFreeMapのベクタータイルスタイル（多言語対応）
    const styleUrl = resolvedTheme === 'dark'
      ? `https://tiles.openfreemap.org/styles/dark`
      : `https://tiles.openfreemap.org/styles/liberty`;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: styleUrl,
      center: [0, 30],
      zoom: 1
    });

    map.current.addControl(new maplibregl.NavigationControl());
    map.current.addControl(new FitAllControl(t('fitAll'), () => fitAllRef.current()));

    // スタイル読み込み後に言語を設定してマーカーを追加
    map.current.on('load', () => {
      if (!map.current) return;

      const style = map.current.getStyle();
      if (!style || !style.layers) return;

      // テキストラベルのレイヤーを探して言語を変更
      style.layers.forEach((layer) => {
        if (layer.type === 'symbol' && layer.layout && 'text-field' in layer.layout) {
          const textField = layer.layout['text-field'];
          if (textField && typeof textField === 'object') {
            // name:ja, name:en などの形式で言語を指定
            map.current!.setLayoutProperty(
              layer.id,
              'text-field',
              ['coalesce', ['get', `name:${lang}`], ['get', 'name']]
            );
          }
        }
      });

      mapReadyRef.current = true;

      // マップ準備完了後に画像とマーカーを追加
      syncOverlay();
      addMarkersToMap();
    });

    return () => {
      mapReadyRef.current = false;
      map.current?.remove();
      map.current = null;
    };
  }, [locale, resolvedTheme]);

  // featuresが変わったらマーカーを再追加
  useEffect(() => {
    addMarkersToMap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [features]);

  // 重ねる画像が変わったら貼り直し、全体が見える縮尺に戻す
  useEffect(() => {
    syncOverlay();
    fitAll(0);
  }, [overlay?.url, overlay?.corners]);

  useEffect(() => {
    const m = map.current;
    if (!m || !mapReadyRef.current || !m.getLayer(OVERLAY_LAYER)) return;
    m.setLayoutProperty(OVERLAY_LAYER, 'visibility', overlayVisible ? 'visible' : 'none');
    m.setPaintProperty(OVERLAY_LAYER, 'raster-opacity', overlayOpacity);
  }, [overlayVisible, overlayOpacity]);

  // Update marker colors when selection changes
  useEffect(() => {
    markersRef.current.forEach((marker, id) => {
      const el = marker.getElement();
      el.style.backgroundColor = id === selectedId ? '#ef4444' : '#3b82f6';
    });

    // Fly to selected marker
    if (selectedId) {
      const feature = features.find((f, idx) => geoFeatureIdOf(f, idx) === selectedId);
      if (feature && map.current) {
        // 選んだピンへ移る。今より引かない（全体に合わせた拡大のまま、中心だけ動かす）
        map.current.flyTo({
          center: feature.geometry.coordinates,
          zoom: Math.max(map.current.getZoom(), 4),
          duration: 1000
        });
      }
    }
  }, [selectedId, features]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />
      {overlay && (
        <div className="absolute bottom-8 left-2 z-10 flex items-center gap-2 rounded-md bg-white/90 dark:bg-gray-800/90 px-3 py-2 shadow text-sm text-gray-700 dark:text-gray-200">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={overlayVisible}
              onChange={(e) => setOverlayVisible(e.target.checked)}
            />
            {t('overlayImage')}
          </label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={overlayOpacity}
            disabled={!overlayVisible}
            onChange={(e) => setOverlayOpacity(Number(e.target.value))}
            aria-label={t('overlayOpacity')}
            title={t('overlayOpacity')}
            className="w-24 disabled:opacity-40"
          />
        </div>
      )}
    </div>
  );
}
