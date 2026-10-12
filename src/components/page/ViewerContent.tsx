'use client';

import type { NextPage } from 'next';
import { Suspense, useEffect } from 'react';
import { useAtom } from 'jotai';
import { useSearchParams, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { Viewer, manifestUrlAtom, type InfoTab } from '@nakamura196/iiif-viewer';
import ManifestInput from '@/components/Input';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Link } from '@/i18n/routing';

const TABS: InfoTab[] = ['metadata', 'annotations'];

// /viewer?manifest=...&tab=...: ビューア本体はパッケージの Viewer。
// ここでは URL の読み書きと、ヘッダー・フッター・入力欄だけを持つ。
const ViewerContent: NextPage = () => {
  // Header も同じ値（ダウンロードのリンクなど）を読むので、サイト側の store に持つ
  const [manifestUrl, setManifestUrl] = useAtom(manifestUrlAtom);
  const searchParams = useSearchParams();
  const router = useRouter();
  const locale = useLocale();
  const { resolvedTheme } = useTheme();
  const tc = useTranslations('Compare');

  useEffect(() => {
    const manifestParam = new URLSearchParams(window.location.search).get('manifest');
    if (manifestParam) setManifestUrl(manifestParam);
  }, [setManifestUrl]);

  // モバイルのブラウザで 100vh がずれるのを避けるための --vh
  useEffect(() => {
    const handleResize = () => {
      document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const tabParam = searchParams?.get('tab') as InfoTab | null;
  const tab = tabParam && TABS.includes(tabParam) ? tabParam : undefined;

  const handleTabChange = (next: InfoTab) => {
    const params = new URLSearchParams(searchParams?.toString() || '');
    params.set('tab', next);
    // 履歴に追加して URL を更新
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="flex flex-col h-screen">
      <Header />
      <main className="flex-1 flex overflow-hidden">
        {manifestUrl ? (
          <Viewer
            iiifContent={manifestUrl}
            locale={locale === 'en' ? 'en' : 'ja'}
            theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
            tab={tab}
            onTabChange={handleTabChange}
            renderActions={({ iiifContent, hasChoices }) =>
              // 候補が 2 つ以上あれば、2 つを並べて見比べるページへ
              hasChoices ? (
                <Link
                  href={`/compare?manifest=${encodeURIComponent(iiifContent)}`}
                  className="text-sm px-3 py-1.5 bg-[var(--ds-surface)] rounded-lg shadow-md border border-[var(--ds-border)] text-[var(--ds-fg)] hover:bg-[var(--ds-surface-2)]"
                >
                  {tc('open')}
                </Link>
              ) : null
            }
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ManifestInput onSubmit={(url: string) => setManifestUrl(url)} />
          </div>
        )}
      </main>
      {!manifestUrl && <Footer />}
    </div>
  );
};

const ViewerContentWithSuspense: NextPage = () => (
  <Suspense fallback={null}>
    <ViewerContent />
  </Suspense>
);

export default ViewerContentWithSuspense;
