import type { MetadataRoute } from 'next';
import { LOCALES, PUBLIC_PATHS, SITE_URL } from '@/lib/site';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  return LOCALES.flatMap((locale) =>
    PUBLIC_PATHS.map((p) => ({
      url: `${SITE_URL}/${locale}/${p}`,
      alternates: {
        languages: Object.fromEntries(LOCALES.map((l) => [l, `${SITE_URL}/${l}/${p}`])),
      },
    })),
  );
}
