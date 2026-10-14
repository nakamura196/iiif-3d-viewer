import { atom } from 'jotai';
import type { InferenceOutput } from '../../core';
import type { Backend } from './ort';

// 推論の結果。Canvas とモデルの組ごとに 1 つ（同じ組で読み直したら置き換える）。Viewer ごとの store に載る。
// 画像に重ねるかどうかは、overlays の localAnnotationPagesAtom に入れるか外すかで決める。
export interface InferenceResult {
  canvasId: string;
  modelId: string;
  output: InferenceOutput;
  /** The result as a W3C / IIIF AnnotationPage (Canvas coordinates). */
  page: Record<string, unknown>;
  backends: Backend[];
  ms: number;
  /** When it was made (ISO 8601). */
  created: string;
}

export const resultKey = (canvasId: string, modelId: string) => `${canvasId}|${modelId}`;

export const inferenceResultsAtom = atom<Record<string, InferenceResult>>({});
