import type { MetadataRoute } from 'next';
import { LOCALES, PUBLIC_PATHS, SITE_URL } from '@/lib/site';
import { NEWS } from '@/lib/news';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  // お知らせの詳細ページ（/news/<id>/）も載せる
  const paths = [...PUBLIC_PATHS, ...NEWS.map((n) => `news/${n.id}/`)];
  return LOCALES.flatMap((locale) =>
    paths.map((p) => ({
      url: `${SITE_URL}/${locale}/${p}`,
      alternates: {
        languages: Object.fromEntries(LOCALES.map((l) => [l, `${SITE_URL}/${l}/${p}`])),
      },
    })),
  );
}
