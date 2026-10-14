// 画面の側から Worker に推論を頼む。Worker はページに 1 つ、初めて使うときに作る。
import type { InferenceOutput } from '../../core';
import type { Backend } from './ort';
import type { FromWorker, ToWorker } from './protocol';

export interface RunResult {
  output: InferenceOutput;
  backends: Backend[];
  ms: number;
}

interface Pending {
  resolve: (r: RunResult) => void;
  reject: (e: Error) => void;
  onProgress: (stage: string, done: number, total: number) => void;
}

let worker: Worker | null = null;
let nextJob = 1;
const pending = new Map<number, Pending>();

const workerOf = (): Worker => {
  if (worker) return worker;
  const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  w.onmessage = (e: MessageEvent<FromWorker>) => {
    const m = e.data;
    const p = pending.get(m.job);
    if (!p) return;
    if (m.type === 'progress') {
      p.onProgress(m.stage, m.done, m.total);
      return;
    }
    pending.delete(m.job);
    if (m.type === 'result') p.resolve({ output: m.output, backends: m.backends, ms: m.ms });
    else p.reject(new Error(m.message));
  };
  w.onerror = (e) => {
    for (const p of pending.values()) p.reject(new Error(e.message || 'Worker error'));
    pending.clear();
    w.terminate();
    worker = null;
  };
  worker = w;
  return w;
};

/** Runs a model on an image. The bitmap is handed to the Worker (and closed there). */
export const runModel = (
  modelId: string,
  bitmap: ImageBitmap,
  onProgress: (stage: string, done: number, total: number) => void,
): Promise<RunResult> =>
  new Promise((resolve, reject) => {
    const job = nextJob++;
    pending.set(job, { resolve, reject, onProgress });
    const msg: ToWorker = { type: 'run', job, modelId, bitmap };
    workerOf().postMessage(msg, [bitmap]);
  });
