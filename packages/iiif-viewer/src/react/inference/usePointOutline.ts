'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSetAtom } from 'jotai';
import { sam2ViewCrop, toAnnotationPage, type ContainerInfo, type ImageToCanvas, type ManifestV4, type Sam2Point } from '../../core';
import { localAnnotationPagesAtom } from '../overlays/canvasAnnotationState';
import { runModel } from './client';
import type { InferenceModel, PointPrompt } from './models/types';
import { pickedMarksAtom, pointPickerAtom, type PickedPoint } from './pointState';
import { SourceImageError, baseImageLayerOf, loadSourceImage } from './sourceImage';
import { inferenceResultsAtom, resultKey, type InferenceResult } from './state';

// クリックで走るモデル（input: 'points'）の、推論タブ側の受け持ち。
// 「始める」と画像の上の層がクリックを拾い、クリックのたびにモデルを走らせて、結果の注釈を 1 件ずつ足す。
// Shift・Alt のクリックは、最後の 1 件を足し引きした点で取り直して置き換える。
// 画像は Canvas ごとに 1 回だけ取り、Worker にはその写しを渡す（Worker は読んだ部分を覚えている）。

interface Source {
  canvasId: string;
  bitmap: ImageBitmap;
  map: ImageToCanvas;
  key: string;
}

interface Options {
  model: InferenceModel;
  container: ContainerInfo;
  manifest?: ManifestV4 | null;
  locale: 'ja' | 'en';
  /** Name of the n-th thing (1-based), the body of its annotation. */
  labelOf: (n: number) => string;
  newId: () => string;
  onRunning: (r: { stage: string; done: number; total: number } | null) => void;
  /** A failed run (the panel shows the message). */
  onError: (e: unknown) => void;
}

export function usePointOutline({ model, container, manifest, locale, labelOf, newId, onRunning, onError }: Options) {
  const [armed, setArmed] = useState(false);
  const setPicker = useSetAtom(pointPickerAtom);
  const setMarks = useSetAtom(pickedMarksAtom);
  const setResults = useSetAtom(inferenceResultsAtom);
  const setLocal = useSetAtom(localAnnotationPagesAtom);
  const source = useRef<Source | null>(null);
  const last = useRef<PointPrompt | null>(null);
  const busy = useRef(false);
  const canvasId = container.id;
  const key = resultKey(canvasId, model.id);
  const pageSource = `inference:${model.id}`;

  const sourceOf = async (): Promise<Source> => {
    if (source.current?.canvasId === canvasId) return source.current;
    const layer = baseImageLayerOf(manifest, container);
    if (!layer) throw new SourceImageError('noImage');
    onRunning({ stage: 'image', done: 0, total: 1 });
    const src = await loadSourceImage(layer, container, model.imageLongSide);
    source.current?.bitmap.close();
    source.current = { canvasId, bitmap: src.bitmap, map: src.map, key: `${canvasId}|${src.url}` };
    return source.current;
  };

  // 結果（InferenceResult）と画像に重ねる注釈を、両方そろえて書き換える
  const store = (update: (prev: InferenceResult | undefined) => InferenceResult | null) => {
    setResults((rs) => {
      const next = update(rs[key]);
      const out = { ...rs };
      if (next) out[key] = next;
      else delete out[key];
      setLocal((ls) => [
        ...ls.filter((l) => !(l.source === pageSource && l.canvasId === canvasId)),
        ...(next ? [{ source: pageSource, canvasId, page: next.page }] : []),
      ]);
      return out;
    });
  };

  const onPoint = async (p: PickedPoint) => {
    if (busy.current) return;
    busy.current = true;
    try {
      const src = await sourceOf();
      const { map, bitmap } = src;
      const toImage = (x: number, y: number) => ({ x: (x - map.x) / map.scaleX, y: (y - map.y) / map.scaleY });
      const at = toImage(p.x, p.y);
      const inside = (c: PointPrompt['crop']) => at.x >= c.x0 && at.x <= c.x1 && at.y >= c.y0 && at.y <= c.y1;
      const refine = p.mode !== 'new' && !!last.current && inside(last.current.crop);
      let prompt: PointPrompt;
      if (refine) {
        const point: Sam2Point = { ...at, positive: p.mode === 'add' };
        prompt = { points: [...last.current!.points, point], crop: last.current!.crop };
      } else {
        const a = toImage(p.view.x0, p.view.y0);
        const b = toImage(p.view.x1, p.view.y1);
        const crop = sam2ViewCrop({ x0: a.x, y0: a.y, x1: b.x, y1: b.y }, bitmap.width, bitmap.height);
        prompt = { points: [{ ...at, positive: true }], crop };
      }
      const toCanvas = (q: Sam2Point) => ({ x: map.x + q.x * map.scaleX, y: map.y + q.y * map.scaleY, positive: q.positive });
      setMarks({ canvasId, points: prompt.points.map(toCanvas) });
      const copy = await createImageBitmap(bitmap);
      const r = await runModel(model.id, copy, (stage, done, total) => onRunning({ stage, done, total }), {
        prompt,
        imageKey: src.key,
      });
      const found = r.output.items[0];
      if (!found) {
        if (!refine) setMarks(null);
        return;
      }
      last.current = prompt;
      store((prev) => {
        const keep = prev && refine ? prev.output.items.slice(0, -1) : (prev?.output.items ?? []);
        const keepAnns = prev && refine ? (prev.page.items as unknown[]).slice(0, -1) : ((prev?.page.items as unknown[]) ?? []);
        const item = { ...found, label: labelOf(keep.length + 1) };
        const one = toAnnotationPage({ ...r.output, items: [item] }, {
          canvasId,
          map,
          newId,
          generator: { id: model.homepage, name: model.name[locale] },
        });
        const page = prev ? { ...prev.page, items: [...keepAnns, ...(one.items as unknown[])] } : one;
        return {
          canvasId,
          modelId: model.id,
          output: { ...r.output, items: [...keep, item] },
          page,
          backends: r.backends,
          ms: r.ms,
          created: new Date().toISOString(),
        };
      });
    } catch (e) {
      onError(e);
    } finally {
      busy.current = false;
      onRunning(null);
    }
  };

  // 画像の上の層からは、いつも最新の onPoint を呼ぶ
  const handler = useRef(onPoint);
  useEffect(() => {
    handler.current = onPoint;
  });

  const stop = useCallback(() => {
    setArmed(false);
    setPicker(null);
    setMarks(null);
    last.current = null;
  }, [setPicker, setMarks]);

  const start = () => {
    setArmed(true);
    setPicker({ canvasId, onPoint: (p) => void handler.current(p) });
  };

  /** Removes the last thing outlined. */
  const undo = () => {
    last.current = null;
    setMarks(null);
    store((prev) => {
      if (!prev || prev.output.items.length <= 1) return null;
      return {
        ...prev,
        output: { ...prev.output, items: prev.output.items.slice(0, -1) },
        page: { ...prev.page, items: (prev.page.items as unknown[]).slice(0, -1) },
      };
    });
  };

  // 別の Canvas に移ったら・タブを閉じたら、クリックの受け付けをやめる
  useEffect(() => stop, [canvasId, stop]);
  useEffect(
    () => () => {
      source.current?.bitmap.close();
      source.current = null;
    },
    [],
  );

  return { armed, start, stop, undo };
}
