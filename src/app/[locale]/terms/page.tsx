import TermsContent from '@/components/page/TermsContent';
import { getMarkdownContent } from '@/lib/markdown';
import { setRequestLocale } from 'next-intl/server';

export default async function TermsPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const content = getMarkdownContent(locale, 'terms');
  return <TermsContent content={content} />;
}

export function generateStaticParams() {
  return [{ locale: 'en' }, { locale: 'ja' }];
}
