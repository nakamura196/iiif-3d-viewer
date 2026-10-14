'use client';

import type { NextPage } from 'next';
import { Suspense, useEffect, useState } from 'react';
import { useAtom } from 'jotai';
import { useSearchParams, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { Viewer, manifestUrlAtom, type InfoTab } from '@nakamura196/iiif-viewer';
import ManifestInput from '@/components/Input';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Link } from '@/i18n/routing';
import { contentParam, convertToV4, fetchManifest, manifestFromParams, parseManifestV4 } from '@nakamura196/iiif-viewer/core';
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
  const tg = useTranslations('GeoRef');
  // 地図と並べて見られる位置情報（Canvas または Scene の georeferencing）があるか
  const [hasGeoCanvas, setHasGeoCanvas] = useState(false);

  useEffect(() => {
    const manifestParam = manifestFromParams(new URLSearchParams(window.location.search));
    if (manifestParam) setManifestUrl(manifestParam);
  }, [setManifestUrl]);

  useEffect(() => {
    setHasGeoCanvas(false);
    if (!manifestUrl) return;
    let cancelled = false;
    fetchManifest(manifestUrl)
      .then((raw) => {
        if (cancelled || !raw) return;
        // 2D の Canvas か、3D の Scene に位置情報（georeferencing）がある
        const { geoCanvasId, geoFeatures } = parseManifestV4(convertToV4(raw));
        setHasGeoCanvas(!!geoCanvasId || geoFeatures.length > 0);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [manifestUrl]);

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
      <main className="flex-1 flex overflow-hidden relative">
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
        {manifestUrl && hasGeoCanvas && (
          <Link
            href={`/georef?${contentParam(manifestUrl)}`}
            className="absolute bottom-4 left-4 z-10 text-sm px-3 py-1.5 bg-[var(--ds-surface)] rounded-lg shadow-md border border-[var(--ds-border)] text-[var(--ds-fg)] hover:bg-[var(--ds-surface-2)]"
          >
            {tg('viewOnMap')}
          </Link>
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
