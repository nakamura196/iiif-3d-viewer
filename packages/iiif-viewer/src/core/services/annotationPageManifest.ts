// AnnotationPage 単体の JSON（Georeference 拡張）を、注釈が指す画像ごとに Canvas を 1 枚ずつ載せた仮のマニフェストにする。
// geo.ldas.jp と Allmaps（annotations.allmaps.org）は、地点の注釈を AnnotationPage だけで配ることがある。
// そのとき画像は Canvas ではなく、注釈の target.source に Image API のサービス（id・幅・高さ）として書かれている。
// ビューアはマニフェストを 1 つ読む作りなので、Canvas 単体（canvasManifest.ts）と同じく入口で形をそろえる。

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const first = (v: unknown): unknown => (Array.isArray(v) ? v[0] : v);

/** A Presentation 3 AnnotationPage given on its own (not inside a Canvas). */
export const isAnnotationPageJson = (json: unknown): json is Json =>
  isObj(json) && json.type === 'AnnotationPage' && Array.isArray(json.items);

interface ImageSource {
  serviceId: string;
  serviceType: string;
  width: number;
  height: number;
  /** The Canvas the image belongs to, when the annotation says so (Allmaps does). */
  canvas?: Json;
}

// target.source が Image API のサービスで、幅と高さが分かるときだけ読む。
// target が Canvas の URI だけのときは、画像の大きさも場所も分からないので読まない。
const imageSourceOf = (annotation: Json): ImageSource | null => {
  const target = first(annotation.target);
  const source = isObj(target) ? target.source : undefined;
  if (!isObj(source)) return null;
  const serviceId = source.id ?? source['@id'];
  const serviceType = String(source.type ?? source['@type'] ?? '');
  const width = Number(source.width);
  const height = Number(source.height);
  if (typeof serviceId !== 'string' || !/^ImageService/.test(serviceType)) return null;
  if (!(width > 0) || !(height > 0)) return null;
  const canvas = first(source.partOf);
  return {
    serviceId: serviceId.replace(/\/+$/, ''),
    serviceType,
    width,
    height,
    ...(isObj(canvas) && canvas.type === 'Canvas' && typeof canvas.id === 'string' ? { canvas } : {}),
  };
};

const imageServiceOf = ({ serviceId, serviceType }: ImageSource): Json =>
  serviceType === 'ImageService3'
    ? { id: serviceId, type: 'ImageService3', profile: 'level0' }
    : { '@id': serviceId, '@type': serviceType, profile: 'http://iiif.io/api/image/2/level0.json' };

/**
 * A Manifest with one Canvas per image the page's annotations point at, each holding its own
 * annotations. null when it is not an AnnotationPage or no annotation names an image service.
 */
export const manifestFromAnnotationPage = (json: unknown, url: string): Json | null => {
  if (!isAnnotationPageJson(json)) return null;

  // 同じ画像を指す注釈は 1 枚の Canvas にまとめる（並びは最初に出た順）
  const groups = new Map<string, { image: ImageSource; annotations: Json[] }>();
  for (const item of json.items as unknown[]) {
    if (!isObj(item)) continue;
    const image = imageSourceOf(item);
    if (!image) continue;
    const group = groups.get(image.serviceId);
    if (group) group.annotations.push(item);
    else groups.set(image.serviceId, { image, annotations: [item] });
  }
  if (groups.size === 0) return null;

  const items = [...groups.values()].map(({ image, annotations }, i) => {
    const canvasId = typeof image.canvas?.id === 'string' ? image.canvas.id : `${url}#canvas-${i + 1}`;
    const v3 = image.serviceType === 'ImageService3';
    const canvas: Json = {
      id: canvasId,
      type: 'Canvas',
      width: image.width,
      height: image.height,
      items: [
        {
          id: `${canvasId}/page`,
          type: 'AnnotationPage',
          items: [
            {
              id: `${canvasId}/page/image`,
              type: 'Annotation',
              motivation: 'painting',
              target: canvasId,
              body: {
                id: `${image.serviceId}/full/${v3 ? 'max' : 'full'}/0/default.jpg`,
                type: 'Image',
                format: 'image/jpeg',
                width: image.width,
                height: image.height,
                service: [imageServiceOf(image)],
              },
            },
          ],
        },
      ],
      annotations: [
        {
          id: groups.size === 1 && typeof json.id === 'string' ? json.id : `${canvasId}/georef`,
          type: 'AnnotationPage',
          items: annotations,
        },
      ],
    };
    if (image.canvas?.label !== undefined) canvas.label = image.canvas.label;
    return canvas;
  });

  // 名前は AnnotationPage の label、無ければ Allmaps が書く元のマニフェストの label、それも無ければ URL
  const firstCanvas = [...groups.values()][0].image.canvas;
  const sourceManifest = first(firstCanvas?.partOf);
  const label = json.label ?? (isObj(sourceManifest) ? sourceManifest.label : undefined) ?? { none: [url] };

  return {
    // Georeference 拡張の context は AnnotationPage に書かれているので、マニフェストに引き継ぐ
    '@context': json['@context'] ?? 'http://iiif.io/api/presentation/3/context.json',
    id: url,
    type: 'Manifest',
    label,
    items,
  };
};
