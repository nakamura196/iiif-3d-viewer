import { notFound } from 'next/navigation';
import NewsDetailContent from '@/components/page/NewsDetailContent';
import { setRequestLocale } from 'next-intl/server';
import { LOCALES, alternatesFor } from '@/lib/site';
import { NEWS, newsById } from '@/lib/news';
import type { Metadata } from 'next';

export default async function NewsDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  if (!newsById(id)) notFound();
  return <NewsDetailContent id={id} />;
}

export function generateStaticParams() {
  return LOCALES.flatMap((locale) => NEWS.map((n) => ({ locale, id: n.id })));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const n = newsById(id);
  if (!n) return {};
  const lang = locale === 'en' ? 'en' : 'ja';
  return {
    title: n.title[lang],
    description: n.body[lang],
    alternates: alternatesFor(locale, `news/${id}/`),
  };
}
