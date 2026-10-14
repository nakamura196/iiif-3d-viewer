import { kaokoreFace } from './kaokoreFace';
import { SAM2_FILES } from './sam2';
import type { InferenceModel } from './types';

// 顔の検出（kaokoreFace）のあと、枠ごとに SAM 2.1 tiny（Meta。枠を渡すと中の物の範囲を返すモデル）で顔の輪郭を取る。
// 注釈は枠ではなく多角形（SvgSelector）になる。SAM のファイルは sam2.ts。
// SlimSAM（SAM 1 を小さくしたもの）も試したが、江戸名所の顔 21 件の多くで背景ごと囲んだので採らなかった（docs/notes/browser-inference.md）。
export const kaokoreFaceOutline: InferenceModel = {
  id: 'kaokore-face-outline',
  name: { ja: '顔の輪郭（日本の絵画）', en: 'Face outlines in Japanese art' },
  description: {
    ja: '顔を探したあと、1 つずつ顔の形をなぞって、輪郭の多角形で示します。枠だけより時間がかかります。',
    en: 'Finds the faces, then traces each one and marks it with its outline (a polygon). Slower than boxes only.',
  },
  license: 'AGPL-3.0 (face detection) / Apache-2.0 (SAM 2.1)',
  credit: {
    ja: '中村 覚（顔の検出）、Meta（SAM 2.1）',
    en: 'Satoru Nakamura (face detection), Meta (SAM 2.1)',
  },
  homepage: kaokoreFace.homepage,
  files: [...kaokoreFace.files, ...SAM2_FILES],
  imageLongSide: kaokoreFace.imageLongSide,
  load: () => import('./kaokoreFaceOutline.run'),
};
