import { kaokoreFace } from './kaokoreFace';
import { kaokoreFaceOutline } from './kaokoreFaceOutline';
import { ndlKotenOcrLite } from './ndlKotenOcrLite';
import { ndlOcrLite } from './ndlOcrLite';
import type { InferenceModel } from './types';

// 推論タブに並べるモデル。新しいモデルは、ここに 1 行足す。
export const MODELS: InferenceModel[] = [ndlOcrLite, ndlKotenOcrLite, kaokoreFace, kaokoreFaceOutline];

export const modelById = (id: string): InferenceModel | undefined => MODELS.find((m) => m.id === id);
