import GeoRefContent from '@/components/page/GeoRefContent';
import { setRequestLocale } from 'next-intl/server';

export default async function GeoRefPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <GeoRefContent />;
}

export function generateStaticParams() {
  return [{ locale: 'en' }, { locale: 'ja' }];
}
