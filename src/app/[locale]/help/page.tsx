import HelpContent from '@/components/page/HelpContent';
import { getMarkdownContent } from '@/lib/markdown';
import { setRequestLocale } from 'next-intl/server';

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
