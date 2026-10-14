import type { ModelFile } from './types';

// SAM 2.1 tiny（Meta。枠や点を渡すと、その物の範囲を返すモデル）のファイル。onnx-community が ONNX にしたものの fp16 版
// （エンコーダ 67MB・デコーダ 10MB。重みは別ファイル .onnx_data）。顔の輪郭とクリックの切り出しで共有する
// （住所が同じなので、一度ダウンロードすれば両方で使える）。
const SAM = 'https://huggingface.co/onnx-community/sam2.1-hiera-tiny-ONNX/resolve/814a066640debee5a91e70aa401fb8e17e030503/onnx';

export const SAM2_HOMEPAGE = 'https://huggingface.co/onnx-community/sam2.1-hiera-tiny-ONNX';

export const SAM2_FILES: ModelFile[] = [
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
];
