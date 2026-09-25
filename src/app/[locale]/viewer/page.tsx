import ViewerContent from '@/components/page/ViewerContent';
import { setRequestLocale } from 'next-intl/server';
import { alternatesFor } from '@/lib/site';
import type { Metadata } from 'next';

export default async function ViewerPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ViewerContent />;
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
  return { alternates: alternatesFor(locale, 'viewer/') };
}
