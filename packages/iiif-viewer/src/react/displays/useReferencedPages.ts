'use client';

import { useEffect, useMemo, useState } from 'react';
import { annotationSourcesOf } from '../../core';
import { fetchPage } from '../overlays/useCanvasAnnotations';

type Json = Record<string, unknown>;

// 参照だけの AnnotationPage（0079 の字幕など）を取得し、中身を足した Canvas を返す。
// 取得できるまで・取得に失敗したときは、元の Canvas のまま返す。
// 取得は重ね表示と同じ置き場を使うので、同じページを二重に取りに行かない。
export function useReferencedPages(container: Json | undefined): Json | undefined {
  const references = useMemo(() => annotationSourcesOf(container).references, [container]);
  const key = references.join('|');
  const [fetched, setFetched] = useState<{ key: string; pages: unknown[] } | null>(null);

  useEffect(() => {
    if (references.length === 0) return;
    let cancelled = false;
    Promise.allSettled(references.map(fetchPage)).then((results) => {
      if (cancelled) return;
      const pages = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
      setFetched({ key, pages });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return useMemo(() => {
    if (!container || fetched?.key !== key || fetched.pages.length === 0) return container;
    const own = Array.isArray(container.annotations) ? container.annotations : [];
    return { ...container, annotations: [...own, ...fetched.pages] };
  }, [container, fetched, key]);
}
