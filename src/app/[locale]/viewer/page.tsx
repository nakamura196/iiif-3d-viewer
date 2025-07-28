import ViewerContent from '@/components/page/ViewerContent';
import { setRequestLocale } from 'next-intl/server';

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
