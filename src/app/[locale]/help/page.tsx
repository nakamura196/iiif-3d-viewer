import HelpContent from '@/components/page/HelpContent';
import { getMarkdownContent } from '@/lib/markdown';
import { setRequestLocale } from 'next-intl/server';
import { alternatesFor } from '@/lib/site';
import type { Metadata } from 'next';

export default async function HelpPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const content = getMarkdownContent(locale, 'help');
  return <HelpContent content={content} />;
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
  return { alternates: alternatesFor(locale, 'help/') };
}
