'use client';

import { useEffect, useState } from 'react';
import {
  candidatesOfManifest,
  fetchJson,
  infoCandidateOf,
  inlineSharedServices,
  isCollectionJson,
  isImageInfoJson,
  memberManifestUrlsOf,
  upgradeToV3,
  type CompareCandidate,
} from '../../core';

// 別々の資料（Manifest・Collection・info.json）から、見比べる画像を集める。
// 同じ URL の取得は 1 回にまとめる。読めなかった資料は黙って飛ばす。

const jsonCache = new Map<string, Promise<unknown | null>>();
const jsonOf = (url: string) => {
  let p = jsonCache.get(url);
  if (!p) {
    p = fetchJson(url).catch(() => null);
    jsonCache.set(url, p);
  }
  return p;
};

interface Loaded {
  candidates: CompareCandidate[];
  collection: boolean;
}

interface Found extends Loaded {
  /** How many images each URL gave, in the order given (0: it could not be read). */
  counts: number[];
}

// 1 つの URL の資料。Collection は、載っている Manifest（入れ子は見ない）を順に開く。
async function loadSource(url: string, locale: string, member = false): Promise<Loaded> {
  const json = await jsonOf(url);
  if (json == null) return { candidates: [], collection: false };
  if (isImageInfoJson(json)) {
    const c = infoCandidateOf(json, url);
    return { candidates: c ? [c] : [], collection: false };
  }
  // the upgrade rewrites what it is given: work on a copy, so that the cached JSON can be read again
  const v3 = inlineSharedServices(upgradeToV3(structuredClone(json)));
  if (isCollectionJson(v3)) {
    if (member) return { candidates: [], collection: true };
    const parts = await Promise.all(memberManifestUrlsOf(v3).map((u) => loadSource(u, locale, true)));
    return { candidates: parts.flatMap((p) => p.candidates), collection: true };
  }
  return { candidates: candidatesOfManifest(v3, locale).map((c) => ({ ...c, manifest: url })), collection: false };
}

/**
 * The images of several sources, in the order given. `collection`: one of them is a Collection
 * (a comparison of different sources, not of the Choice of one Canvas). `counts`: images per URL.
 * `ready`: all are read.
 */
export function useCompareSources(urls: string[], locale: string): Found & { ready: boolean } {
  const key = JSON.stringify(urls);
  const [res, setRes] = useState<{ key: string; loaded: Found } | null>(null);
  useEffect(() => {
    if (urls.length === 0) return;
    let cancelled = false;
    Promise.all(urls.map((u) => loadSource(u, locale))).then((parts) => {
      if (cancelled) return;
      setRes({
        key: key + locale,
        loaded: {
          candidates: parts.flatMap((p) => p.candidates),
          collection: parts.some((p) => p.collection),
          counts: parts.map((p) => p.candidates.length),
        },
      });
    });
    return () => {
      cancelled = true;
    };
    // urls は key で見張る
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, locale]);
  const ready = res?.key === key + locale;
  return { ...(ready && res ? res.loaded : { candidates: [], collection: false, counts: [] }), ready };
}
