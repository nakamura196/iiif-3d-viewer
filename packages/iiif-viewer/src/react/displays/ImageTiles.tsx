'use client';

import { useEffect, useState } from 'react';
import {
  canvasRectToLayer,
  imageInfoUrl,
  imageRequestUrl,
  intersect,
  parseImageInfo,
  pickScaleFactor,
  placementOf,
  resolveRegion,
  singleImageUrl,
  tileSchemeOf,
  tilesCovering,
  type ImageInfo,
  type ImageLayer,
  type ImageServiceRef,
  type ImageRegion,
} from '../../core';
import { useTranslations } from '../env';
import type { StageInfo } from './ImageView';

// Image API の深いズーム。info.json から「どの大きさの画像を、どの範囲だけ」取るかを決め、
// 見えている範囲のタイルだけを <img> で並べる（依存なし・CSS の位置指定だけ）。

const infoCache = new Map<string, Promise<ImageInfo | null>>();

const loadInfo = (service: ImageServiceRef): Promise<ImageInfo | null> => {
  const url = imageInfoUrl(service);
  let p = infoCache.get(url);
  if (!p) {
    p = fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => parseImageInfo(json))
      .catch(() => null);
    infoCache.set(url, p);
  }
  return p;
};

type InfoState = { status: 'none' | 'loading' | 'error' } | { status: 'ready'; info: ImageInfo };

function useImageInfo(service: ImageServiceRef | undefined): InfoState {
  const key = service ? imageInfoUrl(service) : null;
  const [res, setRes] = useState<{ key: string; info: ImageInfo | null } | null>(null);
  useEffect(() => {
    if (!service || !key) return;
    let cancelled = false;
    loadInfo(service).then((info) => {
      if (!cancelled) setRes({ key, info });
    });
    return () => {
      cancelled = true;
    };
    // `service` is identified by its info.json URL
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  if (!key) return { status: 'none' };
  if (res?.key !== key) return { status: 'loading' };
  return res.info ? { status: 'ready', info: res.info } : { status: 'error' };
}

const pct = (v: number) => `${v * 100}%`;

/**
 * One painted image, placed on the Canvas (its target, or the whole Canvas), turned by its rotation.
 * With an Image API service the sharpest tiles for the view are drawn over a small base image.
 */
export default function ImageLayerView({
  layer,
  canvasWidth,
  canvasHeight,
  stage,
  opacity = 1,
  onFailed,
}: {
  layer: ImageLayer;
  canvasWidth: number;
  canvasHeight: number;
  stage: StageInfo;
  /** 0 to 1 (the Layers tab). */
  opacity?: number;
  onFailed?: () => void;
}) {
  const t = useTranslations('Viewer');
  const state = useImageInfo(layer.service);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  if (state.status === 'loading') {
    return (
      <div className="absolute inset-0 grid place-items-center text-sm text-[var(--ds-fg)]">{t('imageLoading')}</div>
    );
  }

  const info = state.status === 'ready' ? state.info : null;
  const srcW = info?.width ?? layer.width;
  const srcH = info?.height ?? layer.height;
  const target: ImageRegion = layer.target ?? { x: 0, y: 0, w: canvasWidth, h: canvasHeight };

  // the shown part of the source image, and where it sits on the Canvas
  const quarter = layer.rotation % 180 !== 0;
  const region: ImageRegion =
    srcW && srcH
      ? resolveRegion(layer.regionSpec, srcW, srcH)
      : { x: 0, y: 0, w: quarter ? target.h : target.w, h: quarter ? target.w : target.h };
  const place = placementOf(region, target, layer.rotation, layer.mirror);
  const placedW = place.rw * place.k;
  const placedH = place.rh * place.k;

  const turn = `${layer.rotation ? `rotate(${layer.rotation}deg)` : ''}${layer.mirror ? ' scaleX(-1)' : ''}`.trim();
  const frame = {
    position: 'absolute' as const,
    left: pct((place.cx - placedW / 2) / canvasWidth),
    top: pct((place.cy - placedH / 2) / canvasHeight),
    width: pct(placedW / canvasWidth),
    height: pct(placedH / canvasHeight),
    overflow: 'hidden' as const,
    ...(opacity < 1 ? { opacity } : {}),
    ...(turn ? { transform: turn, transformOrigin: 'center center' } : {}),
  };

  // no usable service: the image as the manifest gives it
  if (!info || !layer.service) {
    if (failedUrl === layer.url) return null;
    return (
      <div style={frame}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={layer.url}
          alt=""
          draggable={false}
          className="absolute inset-0 w-full h-full"
          onError={() => {
            setFailedUrl(layer.url);
            onFailed?.();
          }}
        />
      </div>
    );
  }

  const service = layer.service;
  const dpr = typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio || 1, 2);
  const screenPerCanvas = (stage.stageW / canvasWidth) * stage.scale;
  const screenPerSource = screenPerCanvas * place.k * dpr;
  const fullRegion = region.x === 0 && region.y === 0 && region.w === info.width && region.h === info.height;

  // the base image: the whole shown region, small
  const baseWidth = Math.min(region.w, Math.max(256, Math.ceil(region.w * place.k * (stage.stageW / canvasWidth) * dpr)), 1024);
  const base = fullRegion
    ? singleImageUrl(service, info, baseWidth)
    : imageRequestUrl(service, region, baseWidth);

  // tiles for what is visible now
  let tiles: ReturnType<typeof tilesCovering> = [];
  const scheme = tileSchemeOf(info);
  if (scheme && stage.boxW > 0 && stage.stageW > 0) {
    const toCanvas = canvasWidth / stage.stageW;
    const x0 = (-stage.boxW / 2 - stage.tx) / stage.scale + stage.stageW / 2;
    const x1 = (stage.boxW / 2 - stage.tx) / stage.scale + stage.stageW / 2;
    const y0 = (-stage.boxH / 2 - stage.ty) / stage.scale + stage.stageH / 2;
    const y1 = (stage.boxH / 2 - stage.ty) / stage.scale + stage.stageH / 2;
    const visibleCanvas: ImageRegion = { x: x0 * toCanvas, y: y0 * toCanvas, w: (x1 - x0) * toCanvas, h: (y1 - y0) * toCanvas };
    const local = canvasRectToLayer(place, visibleCanvas);
    const visible = intersect({ x: local.x + region.x, y: local.y + region.y, w: local.w, h: local.h }, region);
    if (visible) {
      const sf = pickScaleFactor(scheme.scaleFactors, screenPerSource);
      tiles = tilesCovering(service, info, scheme, sf, visible);
    }
  }

  return (
    <div style={frame}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={base}
        alt=""
        draggable={false}
        className="absolute inset-0 w-full h-full"
        onError={() => {
          if (failedUrl !== base) onFailed?.();
        }}
      />
      {tiles.map((tile) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={tile.key}
          src={tile.url}
          alt=""
          draggable={false}
          className="absolute"
          style={{
            left: pct((tile.x - region.x) / region.w),
            top: pct((tile.y - region.y) / region.h),
            width: pct(tile.w / region.w),
            height: pct(tile.h / region.h),
          }}
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      ))}
    </div>
  );
}
