'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  annotationSourcesOf,
  nextPageOf,
  rawCanvasOf,
  readCanvasAnnotations,
  type CanvasAnnotation,
  type ContainerInfo,
  type ManifestV4,
} from '../../core';

const MAX_FOLLOWED_PAGES = 5;

// 参照だけの AnnotationPage の取得結果。同じ画面で右パネルと重ね表示が同じ物を使うので、
// 取得は 1 回だけにする（失敗は覚えず、次に開いたとき取り直す）。
const pageCache = new Map<string, Promise<unknown>>();

const fetchPage = (url: string): Promise<unknown> => {
  let p = pageCache.get(url);
  if (!p) {
    p = fetch(url, { headers: { Accept: 'application/ld+json, application/json' } }).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    });
    p.catch(() => pageCache.delete(url));
    pageCache.set(url, p);
  }
  return p;
};

interface Fetched {
  key: string;
  pages: unknown[];
  failed: boolean;
}

export interface CanvasAnnotationsState {
  annotations: CanvasAnnotation[];
  loading: boolean;
  failed: boolean;
}

// Canvas の注釈。マニフェストに書かれたものはすぐ、参照だけのページは取得してから足す。
export function useCanvasAnnotations(
  manifest: ManifestV4 | null | undefined,
  container: ContainerInfo | undefined,
): CanvasAnnotationsState {
  const canvasId = container?.kind === 'Canvas' ? container.id : undefined;
  const width = container?.width;
  const height = container?.height;

  const sources = useMemo(
    () => annotationSourcesOf(canvasId ? rawCanvasOf(manifest, canvasId) : undefined),
    [manifest, canvasId],
  );
  const key = `${canvasId ?? ''}|${sources.references.join('|')}`;
  const [fetched, setFetched] = useState<Fetched | null>(null);

  useEffect(() => {
    if (!canvasId || sources.references.length === 0) return;
    let cancelled = false;
    (async () => {
      const pages: unknown[] = [];
      let failed = false;
      for (const ref of sources.references) {
        let url: string | undefined = ref;
        for (let n = 0; url && n < MAX_FOLLOWED_PAGES; n++) {
          try {
            const page = await fetchPage(url);
            pages.push(page);
            // follow `next` only while this page still has annotations for this Canvas
            const mine = readCanvasAnnotations(canvasId, [page], { width, height });
            url = mine.length > 0 ? nextPageOf(page) : undefined;
          } catch {
            failed = true;
            url = undefined;
          }
        }
      }
      if (!cancelled) setFetched({ key, pages, failed });
    })();
    return () => {
      cancelled = true;
    };
  }, [canvasId, key, sources, width, height]);

  const current = fetched?.key === key ? fetched : null;
  const annotations = useMemo(
    () =>
      canvasId
        ? readCanvasAnnotations(canvasId, [...sources.pages, ...(current?.pages ?? [])], { width, height })
        : [],
    [canvasId, sources, current, width, height],
  );
  return {
    annotations,
    loading: sources.references.length > 0 && !current,
    failed: current?.failed ?? false,
  };
}
