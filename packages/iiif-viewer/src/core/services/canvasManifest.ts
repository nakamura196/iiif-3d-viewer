// Canvas 単体の JSON（Presentation 3）を、その Canvas だけを載せた仮のマニフェストにする。
// geo.ldas.jp の例（canvas.json）のように、Georeference 拡張では Canvas を直接配ることがある。
// ビューアはマニフェストを 1 つ読む作りなので、info.json（imageInfoManifest.ts）と同じく入口で形をそろえる。

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);

/** A Presentation 3 Canvas given on its own (not inside a Manifest). */
export const isCanvasJson = (json: unknown): json is Json => isObj(json) && json.type === 'Canvas';

/** A one-Canvas Manifest that holds the given Canvas as is. null when it is not a Canvas. */
export const manifestFromCanvas = (json: unknown, url: string): Json | null => {
  if (!isCanvasJson(json)) return null;
  const { '@context': context, ...canvas } = json;
  const manifest: Json = {
    // Georeference 拡張などの context は Canvas に書かれているので、マニフェストに引き継ぐ
    '@context': context ?? 'http://iiif.io/api/presentation/3/context.json',
    id: url,
    type: 'Manifest',
    label: canvas.label ?? { none: [url] },
    items: [canvas],
  };
  for (const key of ['metadata', 'rights', 'requiredStatement', 'summary', 'thumbnail'] as const) {
    if (canvas[key] !== undefined) manifest[key] = canvas[key];
  }
  return manifest;
};
