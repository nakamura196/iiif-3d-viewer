/// <reference lib="webworker" />
// 推論の Worker。モデルの部品（models/）を読み込み、保存済みのファイルからセッションを作って実行する。
// セッションは作り直さずに持っておく（同じモデルで別の画像を読むとき速い）。
import { modelById } from './models/registry';
import type { ModelFile } from './models/types';
import { readModelFile } from './modelStore';
import { hasWebGpu, loadOrt, type Backend, type OrtSession } from './ort';
import type { FromWorker, ToWorker } from './protocol';

const post = (m: FromWorker) => (self as unknown as Worker).postMessage(m);

const sessions = new Map<string, Promise<{ session: OrtSession; backend: Backend }>>();
let gpu: Promise<boolean> | null = null;

const sessionOf = (file: ModelFile, prefer: Backend) => {
  const key = `${file.url}|${prefer}`;
  let s = sessions.get(key);
  if (!s) {
    s = (async () => {
      const ort = await loadOrt();
      const bytes = await readModelFile(file);
      const externalData = file.data ? [{ path: file.data.path, data: await readModelFile(file.data) }] : undefined;
      if (prefer === 'webgpu' && (await (gpu ??= hasWebGpu()))) {
        try {
          const session = await ort.InferenceSession.create(bytes, { executionProviders: ['webgpu'], graphOptimizationLevel: 'all', externalData });
          return { session, backend: 'webgpu' as const };
        } catch {
          // WebGPU で落ちる演算のある端末では、wasm で作り直す
        }
      }
      const session = await ort.InferenceSession.create(bytes, { executionProviders: ['wasm'], graphOptimizationLevel: 'all', externalData });
      return { session, backend: 'wasm' as const };
    })();
    s.catch(() => sessions.delete(key));
    sessions.set(key, s);
  }
  return s;
};

const run = async ({ job, modelId, bitmap }: ToWorker) => {
  try {
    const model = modelById(modelId);
    if (!model) throw new Error(`Unknown model: ${modelId}`);
    post({ type: 'progress', job, stage: 'load', done: 0, total: 1 });
    const [{ run: runner }, ort] = await Promise.all([model.load(), loadOrt()]);
    const backends = new Set<Backend>();
    const t0 = performance.now();
    const output = await runner({
      ort,
      bitmap,
      session: async (name, prefer) => {
        const file = model.files.find((f) => f.name === name);
        if (!file) throw new Error(`No file "${name}" in ${modelId}`);
        post({ type: 'progress', job, stage: 'load', done: 0, total: 1 });
        const s = await sessionOf(file, prefer);
        backends.add(s.backend);
        return s;
      },
      progress: (stage, done, total) => post({ type: 'progress', job, stage, done, total }),
    });
    post({ type: 'result', job, output, backends: [...backends], ms: performance.now() - t0 });
  } finally {
    bitmap.close();
  }
};

self.onmessage = (e: MessageEvent<ToWorker>) => {
  run(e.data).catch((err: unknown) => post({ type: 'error', job: e.data.job, message: String((err as Error)?.message ?? err) }));
};
