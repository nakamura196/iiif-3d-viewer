// public/ 配下の静的ファイル (例: /manifests/sample-manifest.json) を
// クエリ文字列に乗せて後で fetch する場合、Next.js は basePath を自動付与
// しない。GH Pages デプロイ時に 404 になるのを防ぐため、サイト内パスには
// 必ずこの関数を通してから URL を組み立てる。
//
// - 入力が absolute URL (http(s)://...) ならそのまま返す
// - 既に basePath で始まっていれば二重付与しない
// - basePath が空 (Vercel ルート配信) なら何もしない
export function withBasePath(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
  if (!base) return path;
  if (path.startsWith(`${base}/`) || path === base) return path;
  if (!path.startsWith('/')) return `${base}/${path}`;
  return `${base}${path}`;
}
