import { upgrade } from '@iiif/parser/upgrader';

// Presentation 2 の manifest / collection を 3 に変換する（3 以降はそのまま返す）。
// 変換そのものは IIIF の公式ライブラリ（@iiif/parser の upgrader）に任せる。
//
// ただし upgrader は、oa:Choice に format や画像らしい @id（.jpg 等）があると、
// 型を「Image」と判定して候補を 1 つに潰してしまう（@iiif/parser 4.0.3 で確認）。
// 東京大学のシェリー書簡（https://utda.github.io/shelley/iiif/shelley/manifest.json）が
// まさにこの形で、元画像と透過光画像の切り替えが消える。そこで変換の前に、
// Choice の型判定を誤らせる 2 つだけを外しておく。

const IMAGE_ID = /\.(jpe?g|png)$/;

type Json = Record<string, unknown>;

function fixChoices(v: unknown): void {
  if (Array.isArray(v)) {
    v.forEach(fixChoices);
    return;
  }
  if (typeof v !== 'object' || v === null) return;
  const o = v as Json;
  if (o['@type'] === 'oa:Choice') {
    delete o.format;
    // 候補の 1 つ（default）と同じ @id が付いていることが多い。Choice 自身の id として残すため、断片を足す
    if (typeof o['@id'] === 'string' && IMAGE_ID.test(o['@id'])) o['@id'] = `${o['@id']}#choice`;
  }
  Object.values(o).forEach(fixChoices);
}

const V2_CONTEXTS = ['http://iiif.io/api/presentation/2/context.json', 'http://www.shared-canvas.org/ns/context.json'];

/** Presentation 2 の manifest / collection か（upgrader 自身の判定と同じ基準）。 */
export const isPresentation2 = (json: unknown): boolean => {
  if (typeof json !== 'object' || json === null) return false;
  const o = json as Json;
  const ctx = Array.isArray(o['@context']) ? o['@context'] : [o['@context']];
  if (ctx.some((c) => V2_CONTEXTS.includes(c as string))) return true;
  return typeof o['@id'] === 'string' && (o['@type'] === 'sc:Manifest' || o['@type'] === 'sc:Collection');
};

// 2 のときだけ upgrader に渡す。upgrader は 4 の Scene を扱えない（型の上でも 3 を返す）ので、
// 3 / 4 の manifest は通さない。
export const upgradeToV3 = (json: unknown): unknown => {
  if (!isPresentation2(json)) return json;
  fixChoices(json);
  return upgrade(json);
};
