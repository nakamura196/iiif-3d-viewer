import type { InferenceOutput } from '../../core';
import type { PointPrompt } from './models/types';
import type { Backend } from './ort';

// 画面と Worker の間のやり取り。
export type ToWorker = {
  type: 'run';
  job: number;
  modelId: string;
  bitmap: ImageBitmap;
  prompt?: PointPrompt;
  imageKey?: string;
};

export type FromWorker =
  | { type: 'progress'; job: number; stage: string; done: number; total: number }
  | { type: 'result'; job: number; output: InferenceOutput; backends: Backend[]; ms: number }
  | { type: 'error'; job: number; message: string };
