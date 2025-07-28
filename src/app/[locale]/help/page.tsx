import HelpContent from '@/components/page/HelpContent';
import { setRequestLocale } from 'next-intl/server';

export default async function HelpPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <HelpContent />;
}

export function generateStaticParams() {
  return [{ locale: 'en' }, { locale: 'ja' }];
}
