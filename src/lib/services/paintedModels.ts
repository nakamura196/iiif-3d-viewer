// The 3D models painted into a Scene (Presentation 4.0: painting Annotations in
// Scene.items whose body is a Model). A body may also be a Choice of Models
// (e.g. the same ground as a map or as a street surface); the client shows one
// of them, the first by default, and may let the user switch.

import type { SceneV4 } from '@/types/iiif';

export interface ModelOption {
  url: string;
  label: unknown; // IIIF language map or string, as in the manifest
}

export interface PaintedModel {
  // the painting Annotation's id (key for the chosen option)
  id: string;
  // the Choice's label, or the Model's label
  label: unknown;
  // one entry for a plain Model, several for a Choice
  options: ModelOption[];
  // where the model's origin is placed in the Scene (target PointSelector)
  position: [number, number, number];
}

type Json = Record<string, unknown>;

const asList = (v: unknown): unknown[] => (Array.isArray(v) ? v : v == null ? [] : [v]);

const isPainting = (anno: Json) => asList(anno.motivation).includes('painting');

const modelOption = (body: unknown): ModelOption | null => {
  const b = body as Json | undefined;
  if (b?.type !== 'Model' || typeof b.id !== 'string') return null;
  return { url: b.id, label: b.label };
};

const positionOf = (anno: Json): [number, number, number] => {
  const target = anno.target as Json | undefined;
  const sel = asList(target?.selector).find((s) => (s as Json)?.type === 'PointSelector') as
    | Json
    | undefined;
  const v = [sel?.x ?? 0, sel?.y ?? 0, sel?.z ?? 0].map(Number);
  return v.every(Number.isFinite) ? (v as [number, number, number]) : [0, 0, 0];
};

export const paintedModelsOf = (scene: SceneV4 | undefined): PaintedModel[] => {
  const out: PaintedModel[] = [];
  for (const page of scene?.items ?? []) {
    for (const raw of page.items ?? []) {
      const anno = raw as unknown as Json;
      if (!isPainting(anno)) continue;
      const bodies = asList(anno.body);
      bodies.forEach((body, j) => {
        const b = body as Json;
        const options =
          b?.type === 'Choice'
            ? asList(b.items).map(modelOption).filter((o): o is ModelOption => o !== null)
            : [modelOption(b)].filter((o): o is ModelOption => o !== null);
        if (options.length === 0) return;
        const annoId = String(anno.id ?? `painting-${out.length}`);
        out.push({
          id: bodies.length > 1 ? `${annoId}#body-${j}` : annoId,
          label: b.type === 'Choice' ? b.label : options[0].label,
          options,
          position: positionOf(anno),
        });
      });
    }
  }
  return out;
};

// The URL shown for a painted model: the chosen option, or the first (the default).
export const chosenUrl = (model: PaintedModel, choices: Record<string, number>): string => {
  const i = choices[model.id] ?? 0;
  return (model.options[i] ?? model.options[0]).url;
};

// A IIIF label in the reader's language: the locale, then "none", then any.
export const labelIn = (label: unknown, locale: string): string => {
  if (typeof label === 'string') return label;
  if (!label || typeof label !== 'object') return '';
  const map = label as Record<string, unknown>;
  for (const lang of [locale, 'none', ...Object.keys(map)]) {
    const v = map[lang];
    if (Array.isArray(v) && v.length > 0) return v.map(String).join(' ');
    if (typeof v === 'string') return v;
  }
  return '';
};
