import type { InferenceModel } from './types';

// NDLOCR-Lite（国立国会図書館）。レイアウトの検出（DEIM）と文字の読み取り（PARSeq 30 字・50 字・100 字の 3 本）。
// ファイルは onnxruntime-web 用に手を加えた版（nakamura196/ndlocr-lite-web-onnx。DEIM を WebGPU で動くようにした）。
// 手順は core/features/inference/ndlOcr.ts。
const REPO = 'https://huggingface.co/nakamura196/ndlocr-lite-web-onnx';
const REV = '6b27f9f4586277e050043206c8c1b12a7a565cb0';

export const ndlOcrLite: InferenceModel = {
  id: 'ndlocr-lite',
  name: { ja: 'NDLOCR-Lite', en: 'NDLOCR-Lite' },
  description: {
    ja: '明治以降の活字の資料（縦書き・横書き）の文字を、行ごとに読み取ります。',
    en: 'Reads the text of printed Japanese material from the Meiji era on (vertical or horizontal), line by line.',
  },
  license: 'CC BY 4.0',
  credit: { ja: '国立国会図書館（ブラウザ用の変換: 中村 覚）', en: 'National Diet Library, Japan (converted for browsers by Satoru Nakamura)' },
  homepage: 'https://github.com/ndl-lab/ndlocr-lite',
  files: [
    { name: 'detector', url: `${REPO}/resolve/${REV}/ndlocr-lite-deim-s-layers.onnx`, bytes: 40259416 },
    { name: 'rec30', url: `${REPO}/resolve/${REV}/parseq-ndl-16x256-30-tiny-192epoch-tegaki3.onnx`, bytes: 35848117 },
    { name: 'rec50', url: `${REPO}/resolve/${REV}/parseq-ndl-16x384-50-tiny-146epoch-tegaki2.onnx`, bytes: 36920058 },
    { name: 'rec100', url: `${REPO}/resolve/${REV}/parseq-ndl-16x768-100-tiny-165epoch-tegaki2.onnx`, bytes: 40984184 },
  ],
  // 1,600px では行の高さが 20px 前後になり読み違いが増える（docviz で字の誤り率 1,600px 5.7%、2,048px 4.0%）
  imageLongSide: 2048,
  load: () => import('./ndlOcrLite.run'),
};
