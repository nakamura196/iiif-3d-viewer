import PrivacyContent from '@/components/page/PrivacyContent';
import { getMarkdownContent } from '@/lib/markdown';
import { setRequestLocale } from 'next-intl/server';

export default async function PrivacyPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const content = getMarkdownContent(locale, 'privacy');
  return <PrivacyContent content={content} />;
}

export function generateStaticParams() {
  return [{ locale: 'en' }, { locale: 'ja' }];
}
