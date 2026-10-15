import GalleryContent from '@/components/page/GalleryContent';
import { setRequestLocale } from 'next-intl/server';
import { alternatesFor } from '@/lib/site';
import type { Metadata } from 'next';

export default async function GalleryPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <GalleryContent />;
}

export function generateStaticParams() {
  return [{ locale: 'en' }, { locale: 'ja' }];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: locale === 'en' ? 'IIIF VR Gallery' : 'IIIF バーチャル美術館',
    description:
      locale === 'en'
        ? 'Walk any IIIF Curation, Collection or Manifest as a 3D virtual museum and zoom into the works.'
        : '任意の IIIF（Curation / Collection / Manifest）を 3D の仮想美術館として歩き、作品を深く拡大して見られます。',
    alternates: alternatesFor(locale, 'gallery/'),
  };
}
