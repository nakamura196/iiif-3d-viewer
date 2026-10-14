// 推論の結果（推論に渡した画像の画素）を、Canvas 座標の W3C / IIIF の AnnotationPage にする。
// OCR の行は motivation "supplementing"（画像の一部の文字起こし。textGranularity "line"）、
// 領域は "tagging"（本文は区分名）。どのモデルで作ったかは generator に書く。
import type { InferenceOutput } from './types';

/** How a pixel of the inferred image maps to the Canvas: canvas = offset + pixel * scale. */
export interface ImageToCanvas {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
}

/**
 * The mapping for an image painted on a Canvas, from the size of the image given to the model. `target`: where the
 * image goes on the Canvas (absent: the whole Canvas). Cropped (`regionSpec`), turned or mirrored images are not
 * handled: null.
 */
export const imageToCanvasOf = (
  layer: { target?: { x: number; y: number; w: number; h: number }; regionSpec?: string; rotation: number; mirror: boolean },
  canvas: { width?: number; height?: number },
  imageWidth: number,
  imageHeight: number,
): ImageToCanvas | null => {
  if (layer.regionSpec && layer.regionSpec !== 'full') return null;
  if (layer.rotation % 360 !== 0 || layer.mirror) return null;
  const t = layer.target ?? (canvas.width && canvas.height ? { x: 0, y: 0, w: canvas.width, h: canvas.height } : undefined);
  if (!t || !imageWidth || !imageHeight) return null;
  return { x: t.x, y: t.y, scaleX: t.w / imageWidth, scaleY: t.h / imageHeight };
};

export interface AnnotationPageOptions {
  canvasId: string;
  map: ImageToCanvas;
  /** Ids for the page and its annotations (for example `urn:uuid:...`). */
  newId: () => string;
  generator: { id: string; name: string };
}

const round = (n: number) => Math.round(n);

export const toAnnotationPage = (out: InferenceOutput, o: AnnotationPageOptions): Record<string, unknown> => {
  const { map } = o;
  const generator = { id: o.generator.id, type: 'Software', name: o.generator.name };
  const items = out.items
    .filter((d) => (out.kind === 'lines' ? !!d.text : !!d.label))
    .map((d) => {
      const x = round(map.x + d.x * map.scaleX);
      const y = round(map.y + d.y * map.scaleY);
      const w = Math.max(1, round(d.w * map.scaleX));
      const h = Math.max(1, round(d.h * map.scaleY));
      const target = `${o.canvasId}#xywh=${x},${y},${w},${h}`;
      return out.kind === 'lines'
        ? {
            id: o.newId(),
            type: 'Annotation',
            motivation: 'supplementing',
            textGranularity: 'line',
            body: { type: 'TextualBody', value: d.text, format: 'text/plain', ...(out.language ? { language: out.language } : {}) },
            target,
            generator,
          }
        : {
            id: o.newId(),
            type: 'Annotation',
            motivation: 'tagging',
            body: { type: 'TextualBody', value: d.label, purpose: 'tagging', format: 'text/plain' },
            target,
            generator,
          };
    });
  return {
    '@context': [
      'http://iiif.io/api/extension/text-granularity/context.json',
      'http://iiif.io/api/presentation/3/context.json',
    ],
    id: o.newId(),
    type: 'AnnotationPage',
    label: { none: [o.generator.name] },
    items,
  };
};

/** The text of an OCR result, one line per line. */
export const toPlainText = (out: InferenceOutput): string =>
  out.items
    .map((d) => d.text ?? '')
    .filter(Boolean)
    .join('\n');
