import ReferencesContent from '@/components/page/ReferencesContent';
import { setRequestLocale } from 'next-intl/server';

export default async function ReferencesPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ReferencesContent />;
}

export function generateStaticParams() {
  return [{ locale: 'en' }, { locale: 'ja' }];
}
