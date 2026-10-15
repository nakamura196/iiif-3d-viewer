import { notFound } from 'next/navigation';
import SampleDetailContent from '@/components/page/SampleDetailContent';
import { setRequestLocale } from 'next-intl/server';
import { LOCALES, alternatesFor } from '@/lib/site';
import { SAMPLES, sampleById, sampleThumbnailPath } from '@/lib/samples';
import type { Metadata } from 'next';

export default async function SampleDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  if (!sampleById(id)) notFound();
  return <SampleDetailContent id={id} />;
}

// Kasane 独自のサンプル（/samples/kasane/<id>）。/samples/<id> は Cookbook のレシピの詳細
export function generateStaticParams() {
  return LOCALES.flatMap((locale) => SAMPLES.map((s) => ({ locale, id: s.id })));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const s = sampleById(id);
  if (!s) return {};
  const lang = locale === 'en' ? 'en' : 'ja';
  const alternates = alternatesFor(locale, `samples/kasane/${id}/`);
  const image = { url: sampleThumbnailPath(s), width: 640, height: 400, alt: s.title[lang] };
  return {
    title: s.title[lang],
    description: s.note[lang],
    alternates,
    // layout.tsx の openGraph は丸ごと置き換わるので、siteName と locale もここで入れ直す
    openGraph: {
      title: s.title[lang],
      description: s.note[lang],
      url: alternates.canonical,
      siteName: 'IIIF Kasane',
      locale: lang === 'ja' ? 'ja_JP' : 'en_US',
      type: 'article',
      images: [image],
    },
    twitter: {
      card: 'summary_large_image',
      title: s.title[lang],
      description: s.note[lang],
      images: [image.url],
    },
  };
}
