// search の中で使う、JSON を読むための小さな道具と、参照先をまとめて取りに行く処理。

import { upgradeToV3 } from '../../services/upgradeV2';
import type { FetchJson } from './types';

export type Json = Record<string, unknown>;

export const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
export const asList = (v: unknown): unknown[] => (Array.isArray(v) ? v : v == null ? [] : [v]);
export const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);
export const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
export const idOf = (v: unknown): string | undefined =>
  typeof v === 'string' ? str(v) : isObject(v) ? str(v.id ?? v['@id']) : undefined;
export const typeOf = (v: unknown): string => (isObject(v) ? String(v.type ?? v['@type'] ?? '') : '');

export interface FetchAllOptions {
  /** 同時に取りに行く数 */
  concurrency?: number;
  /** 失敗したときに取り直す回数 */
  retries?: number;
  /** 取り直す前に待つ時間（ミリ秒）。n 回目は base × 3^(n-1) */
  retryDelay?: number;
  onProgress?: (done: number, total: number) => void;
  /** 待つ処理（テストで差し替える） */
  sleep?: (ms: number) => Promise<void>;
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * URL の一覧を、同時に concurrency 件まで取りに行き、Presentation 3 に直して返す。
 * 読めなかったものは null（例外は投げない）。
 *
 * 失敗したら、間を空けて retries 回まで取り直す。同時に頼みすぎると断るサーバがある
 * （2026-10-13、e-codices は同時 6 件目から 503 を返した。そのとき CORS の見出しが無いので、
 * ブラウザからは 503 ではなく通信エラーに見える。CODH の画像サーバでも 503 を見ている）。
 */
export async function fetchAllV3(
  urls: string[],
  fetchJson: FetchJson,
  options: FetchAllOptions = {},
): Promise<Map<string, Json | null>> {
  const { concurrency = 4, retries = 4, retryDelay = 500, onProgress, sleep = wait } = options;
  const fetchOne = async (url: string): Promise<Json | null> => {
    for (let attempt = 0; ; attempt++) {
      try {
        const raw = upgradeToV3(await fetchJson(url));
        return isObject(raw) ? raw : null;
      } catch {
        if (attempt >= retries) return null;
        await sleep(retryDelay * 3 ** attempt);
      }
    }
  };
  const out = new Map<string, Json | null>();
  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < urls.length) {
      const url = urls[next++];
      out.set(url, await fetchOne(url));
      onProgress?.(++done, urls.length);
    }
  };
  const n = Math.max(1, Math.min(concurrency, urls.length));
  await Promise.all(Array.from({ length: n }, worker));
  return out;
}

export const countFailed = (fetched: Map<string, Json | null>): number =>
  [...fetched.values()].filter((m) => m === null).length;
