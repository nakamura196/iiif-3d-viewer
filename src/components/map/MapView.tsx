'use client';

import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useTheme } from 'next-themes';
import { useLocale } from 'next-intl';

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

interface MapViewProps {
  features: GeoFeature[];
  selectedId: string | null;
  onFeatureClick: (id: string) => void;
}

export default function MapView({ features, selectedId, onFeatureClick }: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const activePopupRef = useRef<maplibregl.Popup | null>(null);
  const { resolvedTheme } = useTheme();
  const locale = useLocale();
  const mapReadyRef = useRef(false);
  const featuresRef = useRef(features);
  const selectedIdRef = useRef(selectedId);
  const onFeatureClickRef = useRef(onFeatureClick);

  // Refsを最新の値で更新
  featuresRef.current = features;
  selectedIdRef.current = selectedId;
  onFeatureClickRef.current = onFeatureClick;

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
      const featureId = feature['@id'] || `geo-feature-${currentFeatures.indexOf(feature)}`;
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

    // Fit bounds if there are features
    if (currentFeatures.length > 0) {
      const bounds = new maplibregl.LngLatBounds();
      currentFeatures.forEach(f => bounds.extend(f.geometry.coordinates));
      map.current.fitBounds(bounds, { padding: 50, maxZoom: 5 });
    }
  };

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

      // マップ準備完了後にマーカーを追加
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

  // Update marker colors when selection changes
  useEffect(() => {
    markersRef.current.forEach((marker, id) => {
      const el = marker.getElement();
      el.style.backgroundColor = id === selectedId ? '#ef4444' : '#3b82f6';
    });

    // Fly to selected marker
    if (selectedId) {
      const feature = features.find((f, idx) => (f['@id'] || `geo-feature-${idx}`) === selectedId);
      if (feature && map.current) {
        map.current.flyTo({
          center: feature.geometry.coordinates,
          zoom: 4,
          duration: 1000
        });
      }
    }
  }, [selectedId, features]);

  return (
    <div ref={mapContainer} className="w-full h-full" />
  );
}
