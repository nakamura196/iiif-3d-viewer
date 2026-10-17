import { notFound } from 'next/navigation';
import RecipeDetailContent from '@/components/page/RecipeDetailContent';
import { setRequestLocale } from 'next-intl/server';
import { LOCALES, alternatesFor } from '@/lib/site';
import { COOKBOOK_RECIPES, recipeById } from '@/lib/cookbookRecipes';
import ja from '@/messages/ja.json';
import en from '@/messages/en.json';
import type { Metadata } from 'next';

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  if (!recipeById(id)) notFound();
  return <RecipeDetailContent id={id} />;
}

// Cookbook のレシピ（/samples/<id>）。Kasane 独自のサンプルは /samples/kasane/<id>。
// 静的な kasane/ が先に当たるので、レシピの id に 'kasane' は使えない（テストで見張る）
export function generateStaticParams() {
  return LOCALES.flatMap((locale) => COOKBOOK_RECIPES.map((r) => ({ locale, id: r.id })));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const r = recipeById(id);
  if (!r) return {};
  const lang = locale === 'en' ? 'en' : 'ja';
  const m = (lang === 'ja' ? ja : en).Samples;
  const title = `${r.id} ${r.title[lang]}`;
  // note が無いときは、分類と確認状況から短い説明を作る
  const description =
    r.note?.[lang] ??
    m.description
      .replace('{id}', r.id)
      .replace('{category}', m.category[r.category])
      .replace('{status}', m.status[r.status]);
  const alternates = alternatesFor(locale, `samples/${id}/`);
  // レシピごとの画像は無いので、og:image は指定せず layout.tsx の既定に任せる
  return {
    title,
    description,
    alternates,
    openGraph: {
      title,
      description,
      url: alternates.canonical,
      siteName: 'IIIF Kasane',
      locale: lang === 'ja' ? 'ja_JP' : 'en_US',
      type: 'article',
      images: [{ url: '/opengraph-image.png', width: 1200, height: 630, alt: 'IIIF Kasane' }],
    },
    twitter: { card: 'summary_large_image', title, description, images: ['/twitter-image.png'] },
  };
}
