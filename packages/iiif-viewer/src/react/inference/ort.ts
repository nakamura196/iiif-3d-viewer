// onnxruntime-web（ブラウザでモデルを動かす実行エンジン）を、使うときに CDN から読む。Worker の中だけで使う。
// 同梱しない理由: WebGPU 用の wasm が約 26MB あり、サイトの配布物とビューアの埋め込み（<iiif-viewer>）が重くなる。
// また Next.js の bundler が onnxruntime-web の wasm の読み込みを書き換えて壊すことがある。版は固定する。
// 型は使う所だけ、ここに書く（npm の onnxruntime-web は入れない）。

export const ORT_VERSION = '1.26.0';
const ORT_DIR = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;

export interface OrtTensor {
  readonly data: unknown;
  readonly dims: readonly number[];
}

export interface OrtSession {
  readonly inputNames: readonly string[];
  readonly outputNames: readonly string[];
  run(feeds: Record<string, OrtTensor>): Promise<Record<string, OrtTensor>>;
}

export type Backend = 'webgpu' | 'wasm';

export interface OrtModule {
  InferenceSession: {
    create(model: Uint8Array, options: { executionProviders: Backend[]; graphOptimizationLevel?: 'all' }): Promise<OrtSession>;
  };
  Tensor: {
    new (type: 'float32', data: Float32Array, dims: number[]): OrtTensor;
    new (type: 'int64', data: BigInt64Array, dims: number[]): OrtTensor;
  };
  env: { wasm: { wasmPaths?: string; numThreads?: number } };
}

let loading: Promise<OrtModule> | null = null;

export const loadOrt = (): Promise<OrtModule> => {
  loading ??= (async () => {
    const entry = `${ORT_DIR}ort.webgpu.bundle.min.mjs`;
    const mod = (await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ /* @vite-ignore */ entry)) as OrtModule;
    mod.env.wasm.wasmPaths = ORT_DIR;
    // 複数スレッドは cross-origin isolation（COOP/COEP）が要る。サイトでは入れていないので 1 本で動かす
    mod.env.wasm.numThreads = (globalThis as { crossOriginIsolated?: boolean }).crossOriginIsolated
      ? Math.min(4, navigator.hardwareConcurrency || 1)
      : 1;
    return mod;
  })();
  loading.catch(() => (loading = null));
  return loading;
};

/** Whether this browser can run WebGPU (an adapter is available). */
export const hasWebGpu = async (): Promise<boolean> => {
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
  return !!(gpu && (await gpu.requestAdapter().catch(() => null)));
};
