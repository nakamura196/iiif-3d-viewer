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
import { contentParam, manifestFromParams } from '@nakamura196/iiif-viewer/core';
import { isViewerTab } from '@/lib/viewerTabs';

// /viewer?iiif-content=...&tab=...（?manifest=... も読む）: ビューア本体はパッケージの Viewer。
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
    const manifestParam = manifestFromParams(new URLSearchParams(window.location.search));
    if (manifestParam) setManifestUrl(manifestParam);
  }, [setManifestUrl]);

  const tabParam = searchParams?.get('tab');
  const tab = isViewerTab(tabParam) ? tabParam : undefined;

  const handleTabChange = (next: InfoTab) => {
    const params = new URLSearchParams(searchParams?.toString() || '');
    params.set('tab', next);
    // 履歴に追加して URL を更新
    router.push(`?${params.toString()}`);
  };

  return (
    // h-dvh: スマホではブラウザのツールバーの分だけ 100vh が見える範囲より高く、下端が隠れるため
    <div className="flex flex-col h-dvh">
      <Header compact />
      <main className="flex-1 flex overflow-hidden">
        {manifestUrl ? (
          <Viewer
            iiifContent={manifestUrl}
            locale={locale === 'en' ? 'en' : 'ja'}
            theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
            tab={tab}
            onTabChange={handleTabChange}
            renderActions={({ iiifContent, hasChoices, selectedIndex }) =>
              // 候補が 2 つ以上あれば、2 つを並べて見比べるページへ（画像は表示中の Canvas を渡す）
              hasChoices ? (
                <Link
                  href={`/compare?${contentParam(iiifContent)}${selectedIndex > 0 ? `&canvas=${selectedIndex}` : ''}`}
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
