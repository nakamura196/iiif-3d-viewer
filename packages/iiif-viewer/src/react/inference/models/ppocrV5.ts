import type { InferenceModel, ModelFile } from './types';

// PaddleOCR PP-OCRv5（PaddlePaddle）の mobile 版。行の検出（DB）と文字の読み取り（CTC）。
// ファイルは公式の Paddle の重みを paddle2onnx で ONNX にしたもの（nakamura196/ppocrv5-mobile-web-onnx。重みは変えていない）。
// 手順は core/features/inference/ppocr.ts。読み取りは 2 種類（中国語・英語・日本語の版と、ラテン文字の版）で、検出は共通。
const REPO = 'https://huggingface.co/nakamura196/ppocrv5-mobile-web-onnx';
const REV = 'dc7e2271c00d961a4c0a38dcebe23beb735ba33e';

const detector: ModelFile = { name: 'detector', url: `${REPO}/resolve/${REV}/PP-OCRv5_mobile_det.onnx`, bytes: 4766440 };

const common = {
  license: 'Apache-2.0',
  credit: { ja: 'PaddlePaddle（ブラウザ用の変換: 中村 覚）', en: 'PaddlePaddle (converted for browsers by Satoru Nakamura)' },
  homepage: 'https://github.com/PaddlePaddle/PaddleOCR',
  // 公式は原寸のまま検出する。2,048px で、英語の活字 1 ページ（42 行）が公式と同じ行に分かれた
  imageLongSide: 2048,
};

export const ppocrV5: InferenceModel = {
  ...common,
  id: 'ppocrv5',
  name: { ja: 'PP-OCRv5（中国語・英語・日本語）', en: 'PP-OCRv5 (Chinese, English, Japanese)' },
  description: {
    ja: '活字の資料（主に横書き）の文字を、行ごとに読み取ります。中国語（簡体字・繁体字）・英語・日本語に対応します。',
    en: 'Reads the text of printed material (mainly horizontal), line by line. Chinese (simplified and traditional), English and Japanese.',
  },
  files: [detector, { name: 'recognizer', url: `${REPO}/resolve/${REV}/PP-OCRv5_mobile_rec.onnx`, bytes: 16537064 }],
  load: () => import('./ppocrV5.run'),
};

export const ppocrV5Latin: InferenceModel = {
  ...common,
  id: 'ppocrv5-latin',
  name: { ja: 'PP-OCRv5（ラテン文字）', en: 'PP-OCRv5 (Latin script)' },
  description: {
    ja: 'ラテン文字の言語（フランス語・ドイツ語・ラテン語など）の活字を、行ごとに読み取ります。',
    en: 'Reads printed text in Latin-script languages (French, German, Latin and others), line by line.',
  },
  files: [detector, { name: 'recognizer', url: `${REPO}/resolve/${REV}/latin_PP-OCRv5_mobile_rec.onnx`, bytes: 8044305 }],
  load: () => import('./ppocrV5Latin.run'),
};
