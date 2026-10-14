// ブラウザ内の推論で、モデルが返すもの。位置は推論に渡した画像の画素（左上が 0,0）。
// Canvas 座標への置き直しと、IIIF の Annotation への書き出しは annotationPage.ts が受け持つ。

/** One thing a model found: a text line (with the text read) or a region (with a class name). */
export interface Detection {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Confidence, 0..1. */
  score: number;
  /** Class name for regions (layout, faces ...). */
  label?: string;
  /** Text read from the region (OCR). */
  text?: string;
}

export interface InferenceOutput {
  /** `lines`: OCR text lines, in reading order. `regions`: boxes with a class name. */
  kind: 'lines' | 'regions';
  items: Detection[];
  /** Size of the image the model was given (the coordinates of `items`). */
  imageWidth: number;
  imageHeight: number;
  /** BCP 47 language of the text, for OCR. */
  language?: string;
}
