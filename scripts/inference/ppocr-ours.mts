// Kasane の手順（core/features/inference/ppocr.ts）で読む。onnxruntime-node と tsx を入れたフォルダで実行する（そこの node_modules から読む）。
// 使い方: npx tsx ppocr-ours.mts <repo> <rgba> <W> <H> <det.onnx> <rec.onnx> <chars.json> <out.json>
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(`${process.cwd()}/package.json`);
const ort = require('onnxruntime-node');
const [repo, rgba, Ws, Hs, detP, recP, charsP, out] = process.argv.slice(2);
const { ppocrRead } = await import(`${repo}/packages/iiif-viewer/src/core/features/inference/ppocr.ts`);
const W = +Ws, H = +Hs;
const page = new Uint8ClampedArray(readFileSync(rgba));
const chars = JSON.parse(readFileSync(charsP, 'utf8'));
const det = await ort.InferenceSession.create(detP);
const rec = await ort.InferenceSession.create(recP);
const t0 = Date.now();
const lines = await ppocrRead(page, W, H, chars, {
  detect: async (input: Float32Array, dw: number, dh: number) =>
    (await det.run({ [det.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, dh, dw]) }))[det.outputNames[0]].data,
  recognize: async (input: Float32Array, width: number) => {
    const o = (await rec.run({ [rec.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, 48, width]) }))[rec.outputNames[0]];
    return { data: o.data, T: o.dims[1], C: o.dims[2] };
  },
  progress: () => {},
});
writeFileSync(out, JSON.stringify(lines));
console.log(out.split('/').pop(), lines.length, 'lines', Date.now() - t0, 'ms');
