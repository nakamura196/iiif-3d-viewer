'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Panel } from '@nakamura196/iiif-viewer';
import { Link } from '@/i18n/routing';
import { contentParam } from '@nakamura196/iiif-viewer/core';
import { OTHER_VIEWS_TAB } from '@/lib/viewerTabs';
import {
  GALLERY_LIMITS,
  GALLERY_LOOKS,
  GALLERY_MODES,
  GALLERY_QUALITIES,
  galleryQuery,
  type GalleryLook,
  type GalleryMode,
  type GalleryQuality,
} from '@/lib/gallery';

// 右パネルの「ほかの表示」タブ。同じ資料を Kasane の別のページ（地図・3D の美術館）で開く。
// 以前はビューアの左下に常にボタンを出していたが、絵や動画に重なるのでタブに移した。
// 美術館は歩き方・内装・画質・枚数を選んでから開く（どれも /gallery/ の URL 引数になる）。

const BUTTON =
  'inline-block px-3 py-1.5 rounded text-sm text-white bg-blue-600 hover:bg-blue-700 no-underline';
const SELECT = 'rounded border border-gray-300 dark:border-gray-600 bg-transparent px-1 py-0.5 text-xs';

interface Props {
  manifestUrl: string;
  hasGeo: boolean;
  galleryOk: boolean;
}

function OtherViews({ manifestUrl, hasGeo, galleryOk }: Props) {
  const t = useTranslations('OtherViews');
  const [mode, setMode] = useState<GalleryMode>('orbit');
  const [look, setLook] = useState<GalleryLook>('standard');
  const [quality, setQuality] = useState<GalleryQuality>('auto');
  const [limit, setLimit] = useState<number>(0);

  return (
    <div className="p-3 space-y-5 text-sm">
      {hasGeo && (
        <section className="space-y-2">
          <h3 className="font-semibold">{t('mapHeading')}</h3>
          <p className="text-xs text-gray-600 dark:text-gray-300">{t('mapHint')}</p>
          <Link href={`/georef?${contentParam(manifestUrl)}`} className={BUTTON}>
            {t('open')}
          </Link>
        </section>
      )}
      {galleryOk && (
        <section className="space-y-2">
          <h3 className="font-semibold">{t('galleryHeading')}</h3>
          <p className="text-xs text-gray-600 dark:text-gray-300">{t('galleryHint')}</p>
          <div className="grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-1.5 text-xs">
            <label htmlFor="gallery-mode">{t('mode')}</label>
            <select id="gallery-mode" className={SELECT} value={mode} onChange={(e) => setMode(e.target.value as GalleryMode)}>
              {GALLERY_MODES.map((m) => (
                <option key={m} value={m}>
                  {t(`modes.${m}`)}
                </option>
              ))}
            </select>
            <label htmlFor="gallery-look">{t('look')}</label>
            <select id="gallery-look" className={SELECT} value={look} onChange={(e) => setLook(e.target.value as GalleryLook)}>
              {GALLERY_LOOKS.map((l) => (
                <option key={l} value={l}>
                  {t(`looks.${l}`)}
                </option>
              ))}
            </select>
            <label htmlFor="gallery-quality">{t('quality')}</label>
            <select
              id="gallery-quality"
              className={SELECT}
              value={quality}
              onChange={(e) => setQuality(e.target.value as GalleryQuality)}
            >
              {GALLERY_QUALITIES.map((q) => (
                <option key={q} value={q}>
                  {t(`qualities.${q}`)}
                </option>
              ))}
            </select>
            <label htmlFor="gallery-limit">{t('limit')}</label>
            <select id="gallery-limit" className={SELECT} value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
              <option value={0}>{t('limitDefault')}</option>
              {GALLERY_LIMITS.map((n) => (
                <option key={n} value={n}>
                  {t('limitOption', { n })}
                </option>
              ))}
            </select>
          </div>
          <Link href={`/gallery?${galleryQuery(manifestUrl, { mode, look, quality, limit })}`} className={BUTTON}>
            {t('view')}
          </Link>
        </section>
      )}
    </div>
  );
}

/** 地図か美術館のどちらかに渡せる資料のときだけ出すタブ。 */
export const otherViewsPanel = (props: Props, label: string): Panel => ({
  id: OTHER_VIEWS_TAB,
  // パズル（110）の後ろ、いちばん右
  order: 120,
  label,
  available: () => props.hasGeo || props.galleryOk,
  Component: () => <OtherViews {...props} />,
});
