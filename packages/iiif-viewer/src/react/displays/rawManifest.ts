'use client';

import { useEffect, useState } from 'react';
import { fetchManifest } from '../../core';

// 元の manifest（変換前）を取る。画像の表示と画像の比較が使う。
// 取り直しはブラウザのキャッシュに当たり、同じ URL の取得は 1 回にまとめる。

const rawCache = new Map<string, Promise<unknown>>();

/** The manifest as served (undefined while loading, null when it could not be read). */
export function useRawManifest(url: string | null): unknown | null | undefined {
  const [res, setRes] = useState<{ url: string; raw: unknown } | null>(null);
  useEffect(() => {
    if (!url) return;
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
  return url && res?.url === url ? res.raw : undefined;
}
