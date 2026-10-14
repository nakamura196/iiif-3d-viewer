import { kaokoreFace } from './kaokoreFace';
import type { InferenceModel } from './types';

// 顔の検出（kaokoreFace）のあと、枠ごとに SAM 2.1 tiny（Meta。枠を渡すと中の物の範囲を返すモデル）で顔の輪郭を取る。
// 注釈は枠ではなく多角形（SvgSelector）になる。SAM は onnx-community が ONNX にしたものの fp16 版
// （エンコーダ 67MB・デコーダ 10MB。重みは別ファイル .onnx_data）。
// SlimSAM（SAM 1 を小さくしたもの）も試したが、江戸名所の顔 21 件の多くで背景ごと囲んだので採らなかった（docs/notes/browser-inference.md）。
const SAM = 'https://huggingface.co/onnx-community/sam2.1-hiera-tiny-ONNX/resolve/814a066640debee5a91e70aa401fb8e17e030503/onnx';

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
  files: [
    ...kaokoreFace.files,
    {
      name: 'sam-encoder',
      url: `${SAM}/vision_encoder_fp16.onnx`,
      bytes: 314925,
      data: { path: 'vision_encoder_fp16.onnx_data', url: `${SAM}/vision_encoder_fp16.onnx_data`, bytes: 67005504 },
    },
    {
      name: 'sam-decoder',
      url: `${SAM}/prompt_encoder_mask_decoder_fp16.onnx`,
      bytes: 229799,
      data: {
        path: 'prompt_encoder_mask_decoder_fp16.onnx_data',
        url: `${SAM}/prompt_encoder_mask_decoder_fp16.onnx_data`,
        bytes: 10454016,
      },
    },
  ],
  imageLongSide: kaokoreFace.imageLongSide,
  load: () => import('./kaokoreFaceOutline.run'),
};
