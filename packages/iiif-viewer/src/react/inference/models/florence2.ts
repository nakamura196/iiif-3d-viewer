import type { InferenceModel, ModelFile } from './types';

// Florence-2 base-ft（Microsoft。1 つのモデルで、説明文・物体の検出・文字の読み取りなどを、指示（タスク）を替えて行う）。
// onnx-community が transformers.js 用に ONNX にした版を使う。軽量化の組み合わせは公式デモ（Xenova/florence2-webgpu）と同じ:
// 画像の読み取りと語の表は fp16、文章を作る側（encoder / decoder）は 4 ビット（q4）。合わせて約 357MB。
// ファイルの住所は transformers.js が取りに行く住所そのもの（florence2.shared.ts が、この保存場所から読ませる）。
// 説明文と検出で同じファイルを使うので、一度ダウンロードすれば両方で使える。
export const FLORENCE2_REPO = 'onnx-community/Florence-2-base-ft';
export const FLORENCE2_REV = 'e88a44eaf3791a35eae0c5a47b3dbcd36e67eb6f';
const BASE = `https://huggingface.co/${FLORENCE2_REPO}/resolve/${FLORENCE2_REV}`;

export const FLORENCE2_DTYPE = {
  embed_tokens: 'fp16',
  vision_encoder: 'fp16',
  encoder_model: 'q4',
  decoder_model_merged: 'q4',
} as const;

const file = (path: string, bytes: number): ModelFile => ({ name: path, url: `${BASE}/${path}`, bytes });

const FILES: ModelFile[] = [
  file('config.json', 5432),
  file('generation_config.json', 292),
  file('preprocessor_config.json', 2673),
  file('tokenizer.json', 2297961),
  file('tokenizer_config.json', 197658),
  file('onnx/embed_tokens_fp16.onnx', 78780290),
  file('onnx/vision_encoder_fp16.onnx', 183930536),
  file('onnx/encoder_model_q4.onnx', 30058778),
  file('onnx/decoder_model_merged_q4.onnx', 64393474),
];

const common = {
  license: 'MIT',
  credit: {
    ja: 'Microsoft（Florence-2）、onnx-community（ブラウザ用の変換）',
    en: 'Microsoft (Florence-2), onnx-community (conversion for the browser)',
  },
  homepage: `https://huggingface.co/${FLORENCE2_REPO}`,
  files: FILES,
  engine: 'transformers',
  // モデルは画像を 768 角に縮めて読む（枠の位置も 1,000 段階）。大きく取っても細かくはならない
  imageLongSide: 1024,
} satisfies Partial<InferenceModel>;

export const florence2Caption: InferenceModel = {
  ...common,
  id: 'florence2-caption',
  name: { ja: '絵の説明文（Florence-2・英語）', en: 'Describe the picture (Florence-2)' },
  description: {
    ja: '画像に何が描かれているかを、英語の文章で書きます。写真や現代の図版が得意で、古い絵は外すこともあります。',
    en: 'Writes, in English, what the image shows. Best on photographs and modern pictures; it may miss on old paintings.',
  },
  load: () => import('./florence2Caption.run'),
};

export const florence2Detect: InferenceModel = {
  ...common,
  id: 'florence2-detect',
  name: { ja: '物の検出（Florence-2・英語）', en: 'Objects (Florence-2)' },
  description: {
    ja: '人・動物・建物・乗り物などを探して、英語の名前を付けた枠で示します。',
    en: 'Finds people, animals, buildings, vehicles and other things, and marks them with boxes named in English.',
  },
  load: () => import('./florence2Detect.run'),
};
