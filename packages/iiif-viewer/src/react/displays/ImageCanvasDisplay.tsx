'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAtomValue } from 'jotai';
import {
  canvasImagesOf,
  fetchManifest,
  labelIn,
  layerThumbnailUrl,
  thumbnailUrlOf,
  type CanvasImages,
  type CanvasPainting,
  type ImageAnnotation,
  type ImageLayer,
  type PaintingContent,
} from '../../core';
import { modelChoicesAtom } from '../atoms';
import { useLocale, useTranslations } from '../env';
import { usePlayback } from '../playback';
import ChoiceBar from './ChoiceBar';
import { AnnotationBoxes, MediaCover, ThumbnailStrip, type ThumbnailItem } from './ImageExtras';
import ImageLayerView from './ImageTiles';
import ImageView from './ImageView';
import { DISPLAYS } from './registry';
import type { Display, DisplayProps } from './types';

// Canvas 全体を「元の manifest のまま」読んで表示する。
// 画像の Image API による深いズーム・回転・合成・Choice・画像を持つ注釈・placeholderCanvas・
// accompanyingCanvas・サムネイル・画像が無い Canvas を扱う。
//
// なぜ元の manifest を取り直すか: 読み込み時の変換（convertToV4）と ContainerInfo は、Canvas の
// 大きさ・Image API の service・SpecificResource（回転や領域）・注釈の位置を落とすため。
// 取り直しはブラウザのキャッシュに当たる。取れなかったときは、変換後の manifest で続ける。

type Json = Record<string, unknown>;

const rawCache = new Map<string, Promise<unknown>>();

function useRawManifest(url: string): unknown | null | undefined {
  const [res, setRes] = useState<{ url: string; raw: unknown } | null>(null);
  useEffect(() => {
    let cancelled = false;
    let p = rawCache.get(url);
    if (!p) {
      p = fetchManifest(url);
      rawCache.set(url, p);
    }
    p.then((raw) => {
      if (!cancelled) setRes({ url, raw });
    });
    return () => {
      cancelled = true;
    };
  }, [url]);
  return res?.url === url ? res.raw : undefined;
}

const itemsOf = (manifest: unknown): Json[] =>
  Array.isArray((manifest as Json | null)?.items) ? ((manifest as Json).items as Json[]) : [];

const hasKind = (p: CanvasPainting, ...kinds: string[]) => p.options.some((o) => kinds.includes(o.kind));

const nextDisplay = (props: DisplayProps): Display | undefined => {
  const i = DISPLAYS.findIndex((d) => d.id === imageCanvasDisplay.id);
  return DISPLAYS.slice(i + 1).find((d) => d.match(props.container));
};

// ---- an image Canvas

function ImageBody({
  props,
  images,
  paintings,
}: {
  props: DisplayProps;
  images: CanvasImages;
  paintings: CanvasPainting[];
}) {
  const choices = useAtomValue(modelChoicesAtom);
  const { container } = props;
  const [failedBase, setFailedBase] = useState(false);

  // one option per painting (the chosen one of a Choice), drawn in painting order
  const shown = paintings.map((p) => {
    const index = Math.min(choices[p.id] ?? 0, p.options.length - 1);
    return p.options[index];
  });
  const layers = shown.map((o) => o.layer).filter((l): l is ImageLayer => !!l);
  const annotations: ImageAnnotation[] = [...layers.flatMap((l) => l.annotations), ...images.annotations];

  const bars: PaintingContent[] = paintings
    .filter((p) => p.options.length > 1)
    .map((p) => ({
      id: p.id,
      label: p.label,
      options: p.options.map((o) => ({ url: o.url, kind: 'Image' as const, label: o.label })),
    }));

  const { width, height } = images;
  const detail = Math.max(0, ...layers.map((l) => l.width ?? 0));
  const key = layers.map((l) => l.url).join('|');

  return (
    <>
      {bars.map((b) => (
        <ChoiceBar key={b.id} painting={b} />
      ))}
      <div className="relative flex-1 min-h-0 min-w-0">
        {width && height ? (
          <ImageView
            key={key}
            canvasWidth={width}
            canvasHeight={height}
            detailWidth={detail || undefined}
            container={container}
            extra={<AnnotationBoxes annotations={annotations} canvasWidth={width} canvasHeight={height} />}
          >
            {(stage) =>
              layers.map((l, i) => (
                <ImageLayerView
                  key={`${i}:${l.url}`}
                  layer={l}
                  canvasWidth={width}
                  canvasHeight={height}
                  stage={stage}
                  onFailed={i === 0 ? () => setFailedBase(true) : undefined}
                />
              ))
            }
          </ImageView>
        ) : (
          // neither the Canvas nor the image says how big it is: the plain image
          layers[0] && <ImageView key={layers[0].url} src={layers[0].url} container={container} />
        )}
        {failedBase && layers.length === 1 && <FailedHint />}
      </div>
    </>
  );
}

function FailedHint() {
  const t = useTranslations('Viewer');
  return (
    <div className="absolute inset-0 grid place-items-center text-sm text-[var(--ds-fg)]" role="alert">
      {t('imageError')}
    </div>
  );
}

// ---- a Canvas that paints no image (missing, or only video / audio)

function Missing({ images }: { images: CanvasImages }) {
  const t = useTranslations('Viewer');
  const ratio = images.width && images.height ? images.width / images.height : 0.7;
  return (
    <div className="relative flex-1 min-h-0 min-w-0 grid place-items-center p-4">
      <div
        className="grid place-items-center border-2 border-dashed border-[var(--ds-border)] text-sm text-[var(--ds-fg)] text-center p-4 max-w-full max-h-full"
        style={{ aspectRatio: ratio, height: '80%' }}
        role="status"
      >
        {t('missingImage')}
      </div>
    </div>
  );
}

function CompanionPicture({ companion }: { companion: NonNullable<CanvasImages['accompanying']> }) {
  const w = companion.width ?? companion.layer.width;
  const h = companion.height ?? companion.layer.height;
  if (!w || !h) return <ImageView src={companion.layer.url} />;
  return (
    <ImageView canvasWidth={w} canvasHeight={h} detailWidth={companion.layer.width}>
      {(stage) => <ImageLayerView layer={companion.layer} canvasWidth={w} canvasHeight={h} stage={stage} />}
    </ImageView>
  );
}

function MediaBody({ props, images, kind }: { props: DisplayProps; images: CanvasImages; kind: 'Video' | 'Audio' }) {
  const next = nextDisplay(props);
  const { mediaRef, currentTime } = usePlayback();
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  if (!next) return null;
  const Next = next.Component;

  const companion = images.accompanying ?? (kind === 'Audio' ? images.placeholder : undefined);
  if (companion) {
    // the picture that goes with the sound (or video): above the player
    return (
      <div className="flex-1 min-h-0 min-w-0 flex flex-col">
        <div className={kind === 'Audio' ? 'relative flex-1 min-h-0' : 'relative flex-1 min-h-0 basis-1/2'}>
          <CompanionPicture companion={companion} />
        </div>
        <div className={kind === 'Audio' ? 'shrink-0 flex flex-col' : 'flex-1 min-h-0 flex flex-col basis-1/2'}>
          <Next {...props} />
        </div>
      </div>
    );
  }

  // a video shows its placeholder (or thumbnail) until it is played
  const cover = kind === 'Video' ? images.placeholder?.layer.url ?? images.thumbnail : undefined;
  return (
    <div className="relative flex-1 min-h-0 min-w-0 flex flex-col">
      <Next {...props} />
      {cover && (
        <MediaCover
          src={cover}
          dismissed={dismissedId === props.container.id || currentTime > 0}
          onDismiss={() => setDismissedId(props.container.id)}
          onPlay={() => {
            mediaRef.current?.play()?.catch(() => {});
          }}
        />
      )}
    </div>
  );
}

// ---- thumbnails of the manifest's containers

function useThumbnails(props: DisplayProps, rawManifest: unknown): ThumbnailItem[] | null {
  const locale = useLocale();
  const { containers } = props;
  return useMemo(() => {
    const byId = new Map<string, Json>();
    for (const c of itemsOf(rawManifest ?? props.manifest)) byId.set(String(c.id ?? ''), c);
    const manifestThumb = thumbnailUrlOf((rawManifest as Json | null)?.thumbnail);
    let declared = false;
    const items = containers.map((c, i) => {
      const raw = byId.get(c.id);
      const images = raw ? canvasImagesOf(raw) : undefined;
      let url = images?.thumbnail;
      if (url) declared = true;
      if (!url && containers.length === 1 && manifestThumb) {
        url = manifestThumb;
        declared = true;
      }
      if (!url) {
        const layer = images?.paintings.flatMap((p) => p.options).find((o) => o.layer)?.layer;
        url = layer ? layerThumbnailUrl(layer) : undefined;
      }
      return { key: c.id, label: labelIn(c.label, locale) || String(i + 1), url };
    });
    return declared ? items : null;
  }, [containers, rawManifest, props.manifest, locale]);
}

// ---- the display

function ImageCanvasDisplay(props: DisplayProps) {
  const t = useTranslations('Viewer');
  const raw = useRawManifest(props.iiifContent);
  const thumbs = useThumbnails(props, raw);
  const { container } = props;

  // before the source manifest arrives, a converted Canvas (a Scene) is not yet known to be flat
  const waiting = raw === undefined && container.kind === 'Scene';
  const source = useMemo(() => {
    const items = itemsOf(raw ?? props.manifest);
    return items.find((c) => String(c.id ?? '') === container.id);
  }, [raw, props.manifest, container.id]);
  const images = useMemo(() => canvasImagesOf(source), [source]);

  if (waiting) {
    return <div className="p-4 text-sm text-[var(--ds-fg)]">{t('imageLoading')}</div>;
  }

  const delegate = () => {
    const next = nextDisplay(props);
    return next ? <next.Component {...props} /> : null;
  };

  // a real 3D Scene (without a model yet), or a type this display does not read
  if (!source || source.type === 'Scene') return delegate();

  const imagePaintings = images.paintings.filter((p) => hasKind(p, 'Image'));
  const mediaPainting = images.paintings.find((p) => hasKind(p, 'Video', 'Audio'));

  let body: React.ReactNode;
  if (imagePaintings.length > 0) {
    body = <ImageBody props={props} images={images} paintings={imagePaintings} />;
  } else if (mediaPainting) {
    const kind = mediaPainting.options.find((o) => o.kind === 'Video' || o.kind === 'Audio')!.kind as 'Video' | 'Audio';
    body = <MediaBody props={props} images={images} kind={kind} />;
  } else if (images.paintings.length === 0) {
    body = <Missing images={images} />;
  } else {
    return delegate();
  }

  const showStrip = thumbs && thumbs.length > 0;
  return (
    <>
      {body}
      {showStrip && <ThumbnailStrip items={thumbs} selected={props.selectedIndex} onSelect={props.select} />}
    </>
  );
}

const hasModel = (c: DisplayProps['container']) => c.painting.some((p) => p.options.some((o) => o.kind === 'Model'));

export const imageCanvasDisplay: Display = {
  id: 'image-canvas',
  // Canvas / Timeline that paint something other than a model, and a Scene without a model
  // (a Canvas the converter turned into a Scene: a Choice, a rotated image, a missing image).
  match: (c) => !hasModel(c) && (c.kind === 'Scene' || c.painting.length > 0),
  Component: ImageCanvasDisplay,
};
