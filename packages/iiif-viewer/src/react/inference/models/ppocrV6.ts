import type { InferenceModel } from './types';

// PaddleOCR PP-OCRv6（PaddlePaddle）の small 版。行の検出（DB）と文字の読み取り（CTC）。
// ファイルは PaddlePaddle が HF に置いている公式の ONNX（PP-OCRv6_small_det_onnx・PP-OCRv6_small_rec_onnx）をそのまま使う。
// 手順は v5 と同じ（core/features/inference/ppocr.ts）。公式の OCR パイプラインは v6 でも前処理・後処理の値が v5 と同じ。
// tiny 版（合わせて 6MB）は字の一覧に仮名が無く、日本語が読めないので使わない。
const REPO = 'https://huggingface.co/PaddlePaddle';
const DET_REV = '28fe5895c24fd108c19eb3e8479f4ab385fbfc62';
const REC_REV = 'b8f84f0b80c529de40b4fbb3544b84fa7233a513';

export const ppocrV6: InferenceModel = {
  id: 'ppocrv6',
  name: { ja: 'PP-OCRv6（中国語・英語・日本語）', en: 'PP-OCRv6 (Chinese, English, Japanese)' },
  description: {
    ja: '活字の資料（主に横書き）の文字を、行ごとに読み取ります。PP-OCRv5 の新しい版で、特に日本語の読み落としが減っています。',
    en: 'Reads the text of printed material (mainly horizontal), line by line. The successor of PP-OCRv5, with notably fewer missed characters in Japanese.',
  },
  license: 'Apache-2.0',
  credit: { ja: 'PaddlePaddle', en: 'PaddlePaddle' },
  homepage: 'https://github.com/PaddlePaddle/PaddleOCR',
  files: [
    { name: 'detector', url: `${REPO}/PP-OCRv6_small_det_onnx/resolve/${DET_REV}/inference.onnx`, bytes: 9880512 },
    { name: 'recognizer', url: `${REPO}/PP-OCRv6_small_rec_onnx/resolve/${REC_REV}/inference.onnx`, bytes: 21159378 },
  ],
  // v5 と同じ。公式は原寸のまま検出する
  imageLongSide: 2048,
  load: () => import('./ppocrV6.run'),
};
