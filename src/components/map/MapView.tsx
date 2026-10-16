'use client';

import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// The worker file is copied to public/ at build time (scripts/copy-maplibre-worker.mjs)
maplibregl.setWorkerUrl(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/maplibre/maplibre-gl-worker.mjs`);
import { useTheme } from 'next-themes';
import { useLocale, useTranslations } from 'next-intl';
import { geoFeatureIdOf, type GeorefMapView, type LngLat } from '@nakamura196/iiif-viewer/core';
import { BASEMAPS, basemapOf, type BasemapId } from './basemaps';
import { searchPlaces, type PlaceResult } from './placeSearch';

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
  /** 開いたときの縮尺と中心（URL の mapZoom・mapLat・mapLng）。無ければすべての地点が収まる縮尺にする。 */
  initialView?: GeorefMapView;
  /** 印を立てる地点（URL の lat・lng）。 */
  focus?: { lat: number; lng: number };
  /** 開いたときに選んである地点。initialView があるときは、そこへは飛ばない。 */
  initialSelectedId?: string | null;
  /** 地図を動かし終えるたびに呼ぶ。 */
  onViewChange?: (view: GeorefMapView) => void;
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

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export default function MapView({
  features,
  selectedId,
  onFeatureClick,
  overlay,
  initialView,
  focus,
  initialSelectedId,
  onViewChange,
}: MapViewProps) {
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
  const onViewChangeRef = useRef(onViewChange);

  // 今の縮尺と中心。地図を作り直したとき（テーマ・言語の切り替え）もここから始める
  const viewRef = useRef<GeorefMapView | null>(initialView ?? null);
  // 縮尺と中心が決まっているか（URL で与えられた、または人が動かした）。決まっていれば自動で全体に合わせない
  const keepViewRef = useRef(Boolean(initialView));
  // URL で縮尺と中心が決まっているときは、開いたときの選択（URL の id）へは飛ばない。
  // 地点は地図より後に読み込まれるので、最初に選ばれた地点で見分ける
  const initialSelectedIdRef = useRef(initialSelectedId);
  const firstSelectionRef = useRef(true);
  const hasInitialView = useRef(Boolean(initialView));
  const focusRef = useRef(focus);
  useEffect(() => {
    onViewChangeRef.current = onViewChange;
    initialSelectedIdRef.current = initialSelectedId;
  });

  // 背景地図。切り替えたら地図を作り直す（縮尺と中心・地点・重ねた画像は引き継ぐ）
  const [basemap, setBasemap] = useState<BasemapId>('standard');

  // 地名検索。選んだ場所には印を立てる（地図を作り直しても立て直す）
  const [placeQuery, setPlaceQuery] = useState('');
  const [placeResults, setPlaceResults] = useState<PlaceResult[] | null>(null);
  const [placeSearching, setPlaceSearching] = useState(false);
  const [placeError, setPlaceError] = useState(false);
  const placeAbortRef = useRef<AbortController | null>(null);
  const placeRef = useRef<PlaceResult | null>(null);
  const placeMarkerRef = useRef<maplibregl.Marker | null>(null);
  // 現在地が取れなかったとき（許可されなかった・時間切れ）に出す
  const [geolocateError, setGeolocateError] = useState(false);

  const showPlace = () => {
    const m = map.current;
    const place = placeRef.current;
    placeMarkerRef.current?.remove();
    placeMarkerRef.current = null;
    if (!m || !place) return;
    placeMarkerRef.current = new maplibregl.Marker({ color: '#f97316' })
      .setLngLat([place.lng, place.lat])
      .setPopup(new maplibregl.Popup({ closeOnClick: false, maxWidth: '240px' }).setText(place.name))
      .addTo(m)
      .togglePopup();
  };

  const runPlaceSearch = async () => {
    placeAbortRef.current?.abort();
    const q = placeQuery.trim();
    if (!q) {
      setPlaceResults(null);
      return;
    }
    const ac = new AbortController();
    placeAbortRef.current = ac;
    setPlaceSearching(true);
    setPlaceError(false);
    try {
      const results = await searchPlaces(q, locale, ac.signal);
      if (!ac.signal.aborted) setPlaceResults(results);
    } catch {
      if (!ac.signal.aborted) {
        setPlaceResults(null);
        setPlaceError(true);
      }
    } finally {
      if (!ac.signal.aborted) setPlaceSearching(false);
    }
  };

  const selectPlace = (place: PlaceResult) => {
    placeRef.current = place;
    setPlaceResults(null);
    keepViewRef.current = true;
    showPlace();
    map.current?.flyTo({ center: [place.lng, place.lat], zoom: 15, duration: 1000 });
  };

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
            <img src="${escapeHtml(thumbnail)}" alt="${escapeHtml(title)}" style="width: 100%; height: auto; display: block;" onerror="this.parentElement.style.display='none'" />
          </div>`
        : '';
      const altNamesHtml = altNames
        ? `<div style="font-size: 12px; color: ${isDark ? '#9ca3af' : '#6b7280'}; margin-top: 4px;">${escapeHtml(altNames)}</div>`
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
          <div style="font-weight: bold;">${escapeHtml(title)}</div>
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

    fitAll(0, true);
  };

  // すべてのピンが収まるように合わせる（地球儀なら大陸の規模、街なら通りの規模になる）。
  // ピンが 1 つ・ごく近いときに寄りすぎないよう、上限は建物が見える程度。
  // 開いたときと、「全体を表示」ボタンを押したときに使う
  // 自動で合わせるとき（auto）は、縮尺と中心が決まっていれば何もしない。
  // 地点を選んであれば、全体の縮尺のまま、その地点を中心にする
  const fitAll = (duration = 600, auto = false) => {
    const currentFeatures = featuresRef.current;
    if (!map.current || currentFeatures.length === 0) return;
    if (auto && keepViewRef.current) return;
    // 「全体を表示」を押したら、以後は自動で合わせない
    if (!auto) keepViewRef.current = true;
    const bounds = new maplibregl.LngLatBounds();
    currentFeatures.forEach(f => bounds.extend(f.geometry.coordinates));
    // 画像を重ねているときは、画像の全体も収める
    overlayRef.current?.corners.forEach(c => bounds.extend(c));
    map.current.fitBounds(bounds, { padding: 50, maxZoom: 17, duration });
    const selected = auto
      ? currentFeatures.find((f, idx) => geoFeatureIdOf(f, idx) === selectedIdRef.current)
      : undefined;
    if (selected) {
      map.current.jumpTo({ center: selected.geometry.coordinates, zoom: Math.max(map.current.getZoom(), 4) });
    }
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

    // 標準は OpenFreeMap のベクタータイル（多言語対応）。ほかは basemaps.ts
    const base = basemapOf(basemap);
    const styleUrl = base.style(resolvedTheme === 'dark');

    const start = viewRef.current;
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: styleUrl,
      center: start ? [start.lng, start.lat] : [0, 30],
      zoom: start ? start.zoom : 1,
      attributionControl: { compact: base.collapseAttribution || undefined },
    });

    // 動かし終えたら、縮尺と中心を覚えて知らせる（URL に書く）。
    // 人が動かしたら（操作の元になったイベントがあれば）、以後は自動で合わせない。
    // 地図が枠の大きさに合わせて自分で動いたとき（狭い画面で開いたときなど）は数えない
    const reportView = () => {
      const m = map.current;
      if (!m) return;
      const c = m.getCenter();
      viewRef.current = { zoom: m.getZoom(), lat: c.lat, lng: c.lng };
      onViewChangeRef.current?.(viewRef.current);
    };
    map.current.on('moveend', (e) => {
      if (e.originalEvent) keepViewRef.current = true;
      reportView();
    });

    // URL の lat・lng の地点に印を立て、座標を出しておく
    const focus = focusRef.current;
    if (focus) {
      new maplibregl.Marker({ color: '#f97316' })
        .setLngLat([focus.lng, focus.lat])
        .setPopup(new maplibregl.Popup({ closeOnClick: false }).setText(`${t('coordinates')}: ${focus.lat.toFixed(6)}, ${focus.lng.toFixed(6)}`))
        .addTo(map.current)
        .togglePopup();
    }

    map.current.addControl(new maplibregl.NavigationControl());
    map.current.addControl(new FitAllControl(t('fitAll'), () => fitAllRef.current()));
    // 現在地。押すと、いる場所に青い点を出して寄る（地図ライブラリの部品）
    const geolocate = new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true, timeout: 10000 },
      fitBoundsOptions: { maxZoom: 15 },
    });
    geolocate.on('geolocate', () => {
      keepViewRef.current = true;
      setGeolocateError(false);
    });
    geolocate.on('error', () => setGeolocateError(true));
    map.current.addControl(geolocate);
    showPlace();

    // スタイル読み込み後に言語を設定してマーカーを追加
    map.current.on('load', () => {
      if (!map.current) return;

      const style = map.current.getStyle();
      if (!style || !style.layers) return;

      // テキストラベルのレイヤーを探して言語を変更
      if (base.localizeLabels) style.layers.forEach((layer) => {
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

      // 出典の長い地図（れきちず）は、出典を「i」のボタンに畳む（下の「画像を重ねる」に重なるため）
      if (base.collapseAttribution) {
        mapContainer.current?.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
      }

      mapReadyRef.current = true;
      // 開いたときの縮尺と中心も URL に書く（動かさなければ moveend が来ないため）
      reportView();

      // マップ準備完了後に画像とマーカーを追加
      syncOverlay();
      addMarkersToMap();
    });

    return () => {
      mapReadyRef.current = false;
      map.current?.remove();
      map.current = null;
    };
  }, [locale, resolvedTheme, basemap]);

  // featuresが変わったらマーカーを再追加
  useEffect(() => {
    addMarkersToMap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [features]);

  // 重ねる画像が変わったら貼り直し、全体が見える縮尺に戻す
  useEffect(() => {
    syncOverlay();
    fitAll(0, true);
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

    if (selectedId && firstSelectionRef.current) {
      firstSelectionRef.current = false;
      if (hasInitialView.current && selectedId === initialSelectedIdRef.current) return;
    }

    // Fly to selected marker
    if (selectedId) {
      const feature = features.find((f, idx) => geoFeatureIdOf(f, idx) === selectedId);
      if (feature && map.current) {
        keepViewRef.current = true;
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
      {/* 地名検索と背景地図。右上の拡大・縮小のボタンの左に置く（左上の「地図」の札は避ける） */}
      <div className="absolute top-2.5 right-12 left-20 z-10 flex flex-wrap items-start justify-end gap-2 pointer-events-none text-sm">
        <div className="relative w-56 max-w-full pointer-events-auto">
          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              void runPlaceSearch();
            }}
            className="flex rounded-md bg-white/95 dark:bg-gray-800/95 shadow"
          >
            <input
              type="search"
              value={placeQuery}
              onChange={(e) => {
                setPlaceQuery(e.target.value);
                if (!e.target.value) setPlaceResults(null);
              }}
              placeholder={t('placeSearch')}
              aria-label={t('placeSearch')}
              className="min-w-0 flex-1 bg-transparent px-2 py-1.5 text-gray-900 dark:text-gray-100 outline-none"
            />
            <button
              type="submit"
              title={t('placeSearch')}
              aria-label={t('placeSearch')}
              className="px-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
            </button>
          </form>
          {(placeSearching || placeError || placeResults) && (
            <div className="absolute mt-1 w-full max-h-72 overflow-y-auto rounded-md bg-white dark:bg-gray-800 shadow text-gray-800 dark:text-gray-100">
              {placeSearching ? (
                <p className="px-3 py-2 text-gray-500 dark:text-gray-400">{t('placeSearching')}</p>
              ) : placeError ? (
                <p className="px-3 py-2 text-red-600 dark:text-red-400">{t('placeSearchFailed')}</p>
              ) : placeResults && placeResults.length === 0 ? (
                <p className="px-3 py-2 text-gray-500 dark:text-gray-400">{t('noResults')}</p>
              ) : (
                <>
                  <ul>
                    {placeResults?.map((p, i) => (
                      <li key={i}>
                        <button
                          type="button"
                          onClick={() => selectPlace(p)}
                          className="block w-full px-3 py-1.5 text-left hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          <span className="block break-words">{p.name}</span>
                          {p.type && <span className="block text-xs text-gray-500 dark:text-gray-400">{p.type}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                  <p className="border-t border-gray-200 dark:border-gray-700 px-3 py-1 text-[11px] text-gray-500 dark:text-gray-400">
                    {t('placeSearchCredit')}
                  </p>
                </>
              )}
            </div>
          )}
        </div>
        <select
          value={basemap}
          onChange={(e) => setBasemap(e.target.value as BasemapId)}
          aria-label={t('basemap')}
          title={t('basemap')}
          className="pointer-events-auto rounded-md bg-white/95 dark:bg-gray-800/95 px-2 py-1.5 shadow text-gray-900 dark:text-gray-100"
        >
          {BASEMAPS.map((b) => (
            <option key={b.id} value={b.id}>
              {t(b.labelKey)}
            </option>
          ))}
        </select>
      </div>
      {geolocateError && (
        <div role="alert" className="absolute bottom-8 right-2 z-10 flex items-center gap-2 rounded-md bg-white/95 dark:bg-gray-800/95 px-3 py-2 shadow text-sm text-red-600 dark:text-red-400">
          {t('geolocateFailed')}
          <button type="button" onClick={() => setGeolocateError(false)} aria-label={t('close')} className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">
            ×
          </button>
        </div>
      )}
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
