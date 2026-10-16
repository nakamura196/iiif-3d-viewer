import { florence2Caption, florence2Detect } from './florence2';
import { kaokoreFace } from './kaokoreFace';
import { kaokoreFaceOutline } from './kaokoreFaceOutline';
import { ndlKotenOcrLite } from './ndlKotenOcrLite';
import { ndlOcrLite } from './ndlOcrLite';
import { ppocrV5, ppocrV5Latin } from './ppocrV5';
import { ppocrV6 } from './ppocrV6';
import { sam2Click } from './sam2Click';
import type { InferenceModel } from './types';

// 推論タブに並べるモデル。新しいモデルは、ここに 1 行足す。
export const MODELS: InferenceModel[] = [ndlOcrLite, ndlKotenOcrLite, ppocrV6, ppocrV5, ppocrV5Latin, kaokoreFace, kaokoreFaceOutline, sam2Click, florence2Caption, florence2Detect];

export const modelById = (id: string): InferenceModel | undefined => MODELS.find((m) => m.id === id);
