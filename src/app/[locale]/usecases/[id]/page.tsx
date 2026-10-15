import { notFound } from 'next/navigation';
import UseCaseDetailContent from '@/components/page/UseCaseDetailContent';
import { setRequestLocale } from 'next-intl/server';
import { LOCALES, alternatesFor } from '@/lib/site';
import { USE_CASES, thumbnailPathOf, usecaseById } from '@/lib/usecases';
import type { Metadata } from 'next';

export default async function UseCaseDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  if (!usecaseById(id)) notFound();
  return <UseCaseDetailContent id={id} />;
}

export function generateStaticParams() {
  return LOCALES.flatMap((locale) => USE_CASES.map((u) => ({ locale, id: u.id })));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const u = usecaseById(id);
  if (!u) return {};
  const lang = locale === 'en' ? 'en' : 'ja';
  const alternates = alternatesFor(locale, `usecases/${id}/`);
  // サムネイルは metadataBase からの絶対 URL になる。canonical と同じく basePath は付けない
  const image = { url: thumbnailPathOf(u, lang), width: 1280, height: 720, alt: u.title[lang] };
  return {
    title: u.title[lang],
    description: u.note[lang],
    alternates,
    // layout.tsx の openGraph は丸ごと置き換わるので、siteName と locale もここで入れ直す
    openGraph: {
      title: u.title[lang],
      description: u.note[lang],
      url: alternates.canonical,
      siteName: 'IIIF Kasane',
      locale: lang === 'ja' ? 'ja_JP' : 'en_US',
      type: 'article',
      images: [image],
    },
    twitter: {
      card: 'summary_large_image',
      title: u.title[lang],
      description: u.note[lang],
      images: [image.url],
    },
  };
}
