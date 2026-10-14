import type { InferenceModel } from './types';

// NDL古典籍OCR-Lite（国立国会図書館）。行の検出（RTMDet-s）と文字の読み取り（PARSeq）。
// ファイルは onnxruntime-web 用に手を加えた版（nakamura196/ndlkotenocr-lite-web-onnx。検出を NMS の手前で切った）。
// 手順は core/features/inference/ndlKotenOcr.ts。
const REPO = 'https://huggingface.co/nakamura196/ndlkotenocr-lite-web-onnx';
const REV = 'ac0d8e06addea06302e0fa7e10e555938ac29c0f';

export const ndlKotenOcrLite: InferenceModel = {
  id: 'ndlkotenocr-lite',
  name: { ja: 'NDL古典籍OCR-Lite', en: 'NDL Kotenseki OCR-Lite' },
  description: {
    ja: '古典籍（くずし字を含む）の文字を、行ごとに読み取ります。',
    en: 'Reads the text of pre-modern Japanese books (including kuzushiji), line by line.',
  },
  license: 'CC BY 4.0',
  credit: { ja: '国立国会図書館（ブラウザ用の変換: 中村 覚）', en: 'National Diet Library, Japan (converted for browsers by Satoru Nakamura)' },
  homepage: 'https://github.com/ndl-lab/ndlkotenocr-lite',
  files: [
    { name: 'detector', url: `${REPO}/resolve/${REV}/ndlkotenocr-lite-rtmdet-s-viz.onnx`, bytes: 40213139 },
    { name: 'recognizer', url: `${REPO}/resolve/${REV}/parseq-ndl-32x384-tiny-10.onnx`, bytes: 42442247 },
  ],
  // 原本との突き合わせ（27 行すべて一致）に使った大きさ
  imageLongSide: 1600,
  load: () => import('./ndlKotenOcrLite.run'),
};
