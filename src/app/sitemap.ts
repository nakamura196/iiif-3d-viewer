import type { MetadataRoute } from 'next';
import { LOCALES, PUBLIC_PATHS, SITE_URL } from '@/lib/site';
import { NEWS } from '@/lib/news';
import { USE_CASES } from '@/lib/usecases';
import { SAMPLES } from '@/lib/samples';
import { COOKBOOK_RECIPES } from '@/lib/cookbookRecipes';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  // お知らせ・ユースケース・サンプルの詳細ページ（/news/<id>/ など）も載せる
  const paths = [
    ...PUBLIC_PATHS,
    ...NEWS.map((n) => `news/${n.id}/`),
    ...USE_CASES.map((u) => `usecases/${u.id}/`),
    ...SAMPLES.map((x) => `samples/kasane/${x.id}/`),
    ...COOKBOOK_RECIPES.map((r) => `samples/${r.id}/`),
  ];
  return LOCALES.flatMap((locale) =>
    paths.map((p) => ({
      url: `${SITE_URL}/${locale}/${p}`,
      alternates: {
        languages: Object.fromEntries(LOCALES.map((l) => [l, `${SITE_URL}/${l}/${p}`])),
      },
    })),
  );
}
