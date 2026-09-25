// 公開 URL はここ 1 か所で決める(canonical・OGP・robots・sitemap が参照する)。
// 2026-09 に nakamura196.github.io/iiif-3d-viewer から 3d.ldas.jp へ移した。
// 旧 github.io は GitHub Pages の独自ドメイン設定で、旧 3d-iiif-viewer.vercel.app は
// vercel.json で、どちらも同じパスのまま 3d.ldas.jp へ転送される。
export const SITE_URL = 'https://3d.ldas.jp';

export const OLD_HOSTS = ['nakamura196.github.io/iiif-3d-viewer', '3d-iiif-viewer.vercel.app'];

export const LOCALES = ['ja', 'en'] as const;

// sitemap に載せるページ(ロケールの後ろのパス。trailingSlash: true)
export const PUBLIC_PATHS = ['', 'viewer/', 'georef/', 'help/', 'privacy/', 'terms/'];

/**
 * ページの canonical と言語の組。metadataBase (SITE_URL) からの相対で返す。
 * path はロケールの後ろ (例 'help/'、トップは '')。
 */
export function alternatesFor(locale: string, path: string) {
  return {
    canonical: `/${locale}/${path}`,
    languages: Object.fromEntries(LOCALES.map((l) => [l, `/${l}/${path}`])),
  };
}
