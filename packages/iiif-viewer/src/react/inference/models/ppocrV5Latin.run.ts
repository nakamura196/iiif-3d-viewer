import { ppocrRunner } from './ppocr.shared';
// 字の一覧（PaddlePaddle/latin_PP-OCRv5_mobile_rec の inference.yml の character_dict。Apache-2.0）
import chars from './ppocrV5Latin.chars.json';

export const run = ppocrRunner(chars as string[]);
