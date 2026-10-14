import type { InferenceOutput } from '../../../core';
import type { Backend, OrtModule, OrtSession } from '../ort';

// ブラウザ内で動かすモデル 1 つ分の契約。新しいモデルは、このファイルの型で models/<名前>.ts を 1 つ足し、
// models/registry.ts の一覧に 1 行足す。重い処理（run）は load() の先に置き、Worker の中でだけ読み込まれるようにする。

export interface Localized {
  ja: string;
  en: string;
}

export interface ModelFile {
  /** Name the runner asks for (`session(name)`). */
  name: string;
  /** Pinned address (a fixed revision, so a cached file never goes stale). */
  url: string;
  bytes: number;
  /**
   * The weights kept beside the graph (an `.onnx_data` file, for models over 2 GB or exported that way). `path` is
   * the name the graph refers to.
   */
  data?: { path: string; url: string; bytes: number };
}

export interface RunContext {
  ort: OrtModule;
  /** The image to read. The runner may read it more than once; the caller closes it. */
  bitmap: ImageBitmap;
  /** The session of one of the model's files. `prefer` falls back to wasm when WebGPU is missing or fails. */
  session(name: string, prefer: Backend): Promise<{ session: OrtSession; backend: Backend }>;
  /** Progress of a step (`stage` is a key of Inference.stage.*). */
  progress(stage: string, done: number, total: number): void;
}

export type ModelRunner = (ctx: RunContext) => Promise<InferenceOutput>;

export interface InferenceModel {
  id: string;
  name: Localized;
  description: Localized;
  /** License of the model files, and who made them. */
  license: string;
  credit: Localized;
  /** Page about the model (also the `generator` of the annotations it makes). */
  homepage: string;
  files: ModelFile[];
  /** Longest side of the image to give the model (the image is fetched at this size or smaller). */
  imageLongSide: number;
  load: () => Promise<{ run: ModelRunner }>;
}
