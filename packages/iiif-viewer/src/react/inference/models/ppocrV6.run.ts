import { ppocrRunner } from './ppocr.shared';
// 字の一覧（PaddlePaddle/PP-OCRv6_small_rec_onnx の inference.yml の character_dict。Apache-2.0）
import chars from './ppocrV6.chars.json';

export const run = ppocrRunner(chars as string[]);
