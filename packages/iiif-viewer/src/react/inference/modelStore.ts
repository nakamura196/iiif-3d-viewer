// ダウンロードしたモデルの置き場所（ブラウザの Cache Storage）。画面からも Worker からも使う。
// 住所は版を固定してあるので、置いた物が古くなることは無い。モデルを差し替えたら住所が変わり、別の物として取り直す。
import type { InferenceModel } from './models/types';

const CACHE = 'kasane-inference-models';

/** The cache the models are kept in (also given to transformers.js, which looks files up by the same addresses). */
export const openCache = (): Promise<Cache | null> =>
  typeof caches === 'undefined' ? Promise.resolve(null) : caches.open(CACHE).catch(() => null);

/**
 * What came back is HTML, not a model (a server's error page or a dev server's fallback). Such a file must not be
 * kept as a model.
 */
const looksLikeHtml = (b: Uint8Array): boolean => {
  for (let i = 0; i < Math.min(b.length, 64); i++) {
    const c = b[i];
    if (c === 0x20 || c === 0x0a || c === 0x0d || c === 0x09 || c === 0xef || c === 0xbb || c === 0xbf) continue;
    return c === 0x3c; // "<"
  }
  return false;
};

/** Every download of a model: each file, and its weights file when kept apart. */
const downloadsOf = (model: InferenceModel): { url: string; bytes: number }[] =>
  model.files.flatMap((f) => (f.data ? [f, f.data] : [f]));

export type ModelStatus = 'none' | 'partial' | 'ready';

export const modelStatus = async (model: InferenceModel): Promise<ModelStatus> => {
  const cache = await openCache();
  if (!cache) return 'none';
  const hits = await Promise.all(downloadsOf(model).map((f) => cache.match(f.url).then((r) => !!r)));
  return hits.every(Boolean) ? 'ready' : hits.some(Boolean) ? 'partial' : 'none';
};

export const totalBytes = (model: InferenceModel): number => downloadsOf(model).reduce((n, f) => n + f.bytes, 0);

/** Downloads the files that are not stored yet. `onProgress` gets bytes of the whole model. */
export const downloadModel = async (
  model: InferenceModel,
  onProgress: (loaded: number, total: number) => void,
  signal?: AbortSignal,
): Promise<void> => {
  const cache = await openCache();
  if (!cache) throw new Error('Cache Storage is not available');
  const total = totalBytes(model);
  let done = 0;
  for (const f of downloadsOf(model)) {
    if (!(await cache.match(f.url))) {
      const buf = await fetchWithProgress(f, (n) => onProgress(done + n, total), signal);
      await cache.put(f.url, new Response(buf, { headers: { 'Content-Type': 'application/octet-stream' } }));
    }
    done += f.bytes;
    onProgress(done, total);
  }
};

const fetchWithProgress = async (f: { url: string; bytes: number }, onBytes: (n: number) => void, signal?: AbortSignal): Promise<Uint8Array<ArrayBuffer>> => {
  const res = await fetch(f.url, { mode: 'cors', credentials: 'omit', signal });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}: ${f.url}`);
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  let r = await reader.read();
  while (!r.done) {
    chunks.push(r.value);
    loaded += r.value.length;
    onBytes(Math.min(loaded, f.bytes));
    r = await reader.read();
  }
  const out = new Uint8Array(loaded);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  if (looksLikeHtml(out)) throw new Error(`Not a model: ${f.url}`);
  return out;
};

/** The stored bytes of a download (Worker side). */
export const readModelFile = async (f: { url: string }): Promise<Uint8Array> => {
  const cache = await openCache();
  const hit = await cache?.match(f.url);
  if (!hit) throw new Error(`Not downloaded: ${f.url}`);
  return new Uint8Array(await hit.arrayBuffer());
};

export const removeModel = async (model: InferenceModel): Promise<void> => {
  const cache = await openCache();
  if (!cache) return;
  await Promise.all(downloadsOf(model).map((f) => cache.delete(f.url)));
};
