import EditorContent from '@/components/page/EditorContent';
import { setRequestLocale } from 'next-intl/server';

export default async function EditorPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <EditorContent />;
}

export function generateStaticParams() {
  return [{ locale: 'en' }, { locale: 'ja' }];
}
