// マニフェスト末尾の `services` に書かれた service を、途中で id だけ書かれた参照に埋め込む。
// Presentation 3 では、同じ service を何度も書かずに `services` に 1 回だけ書き、各所では
// { id, type } だけで指してよい（Wellcome Collection の Auth 2.0 がこの書き方）。
// 読む側（image・auth など）が中身を探しに行かずに済むよう、読み込んだ直後に置き換える。

type Json = Record<string, unknown>;

const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const idOf = (v: Json): string | undefined =>
  typeof v.id === 'string' ? v.id : typeof v['@id'] === 'string' ? (v['@id'] as string) : undefined;

/** Only an id and a type (and maybe a JSON-LD context): a reference, not a description. */
const isReference = (v: Json): boolean =>
  Object.keys(v).every((k) => k === 'id' || k === 'type' || k === '@id' || k === '@type' || k === '@context');

/** The manifest with `service` references to its `services` replaced by the full descriptions. */
export const inlineSharedServices = <T>(manifest: T): T => {
  if (!isObj(manifest) || !Array.isArray(manifest.services)) return manifest;
  const shared = new Map<string, Json>();
  for (const s of manifest.services) {
    const id = isObj(s) ? idOf(s) : undefined;
    if (id && isObj(s) && !isReference(s)) shared.set(id, s);
  }
  if (shared.size === 0) return manifest;

  // `seen` stops a service that (directly or not) refers to itself
  const walk = (v: unknown, seen: Set<string>): unknown => {
    if (Array.isArray(v)) return v.map((x) => walk(x, seen));
    if (!isObj(v)) return v;
    const out: Json = {};
    for (const [k, x] of Object.entries(v)) {
      if (k === 'service') {
        out[k] = (Array.isArray(x) ? x : [x]).map((s) => {
          const id = isObj(s) ? idOf(s) : undefined;
          const full = id && isObj(s) && isReference(s) && !seen.has(id) ? shared.get(id) : undefined;
          return full ? walk(full, new Set(seen).add(id!)) : walk(s, seen);
        });
        if (!Array.isArray(x)) out[k] = (out[k] as unknown[])[0];
      } else {
        out[k] = walk(x, seen);
      }
    }
    return out;
  };
  return walk(manifest, new Set()) as T;
};
