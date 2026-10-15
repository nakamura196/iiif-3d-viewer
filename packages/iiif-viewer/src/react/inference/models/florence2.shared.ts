import { openCache } from '../modelStore';
import { hasWebGpu, type Backend } from '../ort';
import { FLORENCE2_DTYPE, FLORENCE2_REPO, FLORENCE2_REV } from './florence2';
import type { RunContext } from './types';

// Florence-2 を transformers.js で動かす部分（説明文と検出で共通）。Worker の中だけで使う。
// transformers.js は onnxruntime-web と同じく CDN から読む（同梱しない理由は ort.ts と同じ）。版は固定する。
// ファイルは、推論タブがダウンロードして保存した物だけを使わせる:
// transformers.js が取りに行く住所（huggingface.co/<repo>/resolve/<rev>/<file>）を鍵に、同じ保存場所を引かせる。
// 保存場所に無いモデルのファイルは、取りに行かずに「無い」（404）と答える（ダウンロードの確認を経ずに数百 MB を取りに行かないように）。
// transformers.js からは書き込ませない（「削除」で消せない物が残るため）。onnxruntime-web の wasm はふつうに取りに行く。

const TJS_VERSION = '4.3.1';
const TJS_URL = `https://cdn.jsdelivr.net/npm/@huggingface/transformers@${TJS_VERSION}/dist/transformers.min.js`;

// 使う所だけの型（npm の @huggingface/transformers は入れない）
interface RawImageLike {
  readonly width: number;
  readonly height: number;
}
interface Florence2Processor {
  construct_prompts(task: string): string[];
  (image: RawImageLike, prompts: string[]): Promise<Record<string, unknown>>;
  batch_decode(ids: unknown, o: { skip_special_tokens: boolean }): string[];
  post_process_generation(text: string, task: string, size: [number, number]): Record<string, unknown>;
}
interface Florence2Model {
  generate(o: Record<string, unknown>): Promise<unknown>;
}
interface Transformers {
  env: {
    allowLocalModels: boolean;
    useBrowserCache: boolean;
    useCustomCache: boolean;
    customCache: Pick<Cache, 'match' | 'put'> | null;
    fetch: typeof fetch;
  };
  RawImage: new (data: Uint8ClampedArray, width: number, height: number, channels: 4) => RawImageLike;
  AutoProcessor: { from_pretrained(id: string, o: Record<string, unknown>): Promise<Florence2Processor> };
  Florence2ForConditionalGeneration: { from_pretrained(id: string, o: Record<string, unknown>): Promise<Florence2Model> };
}

const REPO_URL = `https://huggingface.co/${FLORENCE2_REPO}/`;

/**
 * The address of the pinned revision. transformers.js 4.3.1 checks whether the tokenizer is there without the
 * revision (it asks `resolve/main/`), so the same file is looked up under the revision kept here.
 */
const pinned = (url: string): string => url.replace(`${REPO_URL}resolve/main/`, `${REPO_URL}resolve/${FLORENCE2_REV}/`);

let tjs: Promise<Transformers> | null = null;

const loadTransformers = (): Promise<Transformers> => {
  tjs ??= (async () => {
    const mod = (await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ /* @vite-ignore */ TJS_URL)) as Transformers;
    const cache = await openCache();
    if (!cache) throw new Error('Cache Storage is not available');
    mod.env.allowLocalModels = false;
    mod.env.useBrowserCache = false;
    mod.env.useCustomCache = true;
    mod.env.customCache = { match: (key) => cache.match(pinned(String(key))), put: async () => {} };
    const fetchOrig = mod.env.fetch;
    mod.env.fetch = async (input, init) => {
      const url = String(input instanceof Request ? input.url : input);
      if (!url.startsWith(REPO_URL)) return fetchOrig(input, init);
      const hit = await cache.match(pinned(url));
      if (!hit) return new Response(null, { status: 404, statusText: `Not downloaded: ${url}` });
      return init?.method === 'HEAD' ? new Response(null, { status: 200, headers: hit.headers }) : hit;
    };
    return mod;
  })();
  tjs.catch(() => (tjs = null));
  return tjs;
};

/** fp16 の重みを WebGPU で動かすには、GPU が半精度（shader-f16）に対応している必要がある。 */
const hasF16Gpu = async (): Promise<boolean> => {
  if (!(await hasWebGpu())) return false;
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<{ features: Set<string> } | null> } }).gpu;
  const adapter = await gpu?.requestAdapter().catch(() => null);
  return !!adapter?.features.has('shader-f16');
};

interface Loaded {
  t: Transformers;
  processor: Florence2Processor;
  model: Florence2Model;
  backend: Backend;
}

let loaded: Promise<Loaded> | null = null;

const load = (): Promise<Loaded> => {
  loaded ??= (async () => {
    const t = await loadTransformers();
    const opts = { revision: FLORENCE2_REV };
    const processor = await t.AutoProcessor.from_pretrained(FLORENCE2_REPO, opts);
    if (await hasF16Gpu()) {
      try {
        const model = await t.Florence2ForConditionalGeneration.from_pretrained(FLORENCE2_REPO, { ...opts, dtype: FLORENCE2_DTYPE, device: 'webgpu' });
        return { t, processor, model, backend: 'webgpu' as const };
      } catch {
        // WebGPU で落ちる演算のある端末では、wasm で作り直す
      }
    }
    const model = await t.Florence2ForConditionalGeneration.from_pretrained(FLORENCE2_REPO, { ...opts, dtype: FLORENCE2_DTYPE, device: 'wasm' });
    return { t, processor, model, backend: 'wasm' as const };
  })();
  loaded.catch(() => (loaded = null));
  return loaded;
};

/**
 * Runs one Florence-2 task (`<MORE_DETAILED_CAPTION>`, `<OD>` ...) on the image, and returns what
 * `post_process_generation` gives for it (positions in pixels of the image).
 */
export const florence2Task = async ({ bitmap, progress, usedBackend }: RunContext, task: string, maxTokens: number): Promise<unknown> => {
  progress('load', 0, 1);
  const { t, processor, model, backend } = await load();
  usedBackend?.(backend);
  const W = bitmap.width;
  const H = bitmap.height;
  const c = new OffscreenCanvas(W, H).getContext('2d', { willReadFrequently: true })!;
  c.drawImage(bitmap, 0, 0);
  const image = new t.RawImage(c.getImageData(0, 0, W, H).data, W, H, 4);
  progress('generate', 0, 1);
  const inputs = await processor(image, processor.construct_prompts(task));
  const ids = await model.generate({ ...inputs, max_new_tokens: maxTokens, num_beams: 1, do_sample: false });
  const text = processor.batch_decode(ids, { skip_special_tokens: false })[0];
  progress('generate', 1, 1);
  // 横（x）は幅、縦（y）は高さで割り戻す（[幅, 高さ] の順）
  return processor.post_process_generation(text, task, [W, H])[task];
};
