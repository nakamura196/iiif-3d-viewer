'use client';

import { Link } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import { Footer as DsFooter } from '@nakamura196/react-ui';

// 共有デザインシステム (@nakamura196/react-ui) の4列フッター。
// 左ブロック (title + description) ＋ columns (最大3列) = 計4列。
// next-intl の Link を LinkComponent に渡してロケール付きリンクを描画する。
const SAMPLE = '/manifests/sample-manifest.json';
const SAMPLE_ANNOT = '/manifests/sample-manifest-with-annotations.json';

export default function Footer() {
  const t = useTranslations('Footer');

  return (
    <DsFooter
      title={t('title')}
      description={t('description')}
      LinkComponent={Link}
      copyright={`© ${new Date().getFullYear()} ${t('developers')}`}
      columns={[
        // 2列目: 説明系（ヘルプ・規約）
        {
          heading: t('guideHeading'),
          links: [
            { label: t('help'), href: '/help' },
            { label: t('privacy'), href: '/privacy' },
            { label: t('terms'), href: '/terms' },
          ],
        },
        // 3列目: サンプル（Input のサンプルマニフェスト3件）
        {
          heading: t('samplesHeading'),
          links: [
            { label: t('sample1'), href: `/viewer?manifest=${encodeURIComponent(SAMPLE)}` },
            { label: t('sample2'), href: `/viewer?manifest=${encodeURIComponent(SAMPLE_ANNOT)}&tab=annotations` },
            { label: t('sample3'), href: `/georef?manifest=${encodeURIComponent(SAMPLE_ANNOT)}` },
          ],
        },
        // 4列目: 関連サイト（旧 References ページの外部リンク）
        {
          heading: t('relatedHeading'),
          links: [
            {
              label: t('relatedArticle'),
              href: 'https://tech.ldas.jp/ja/posts/iiif-3d-viewer-presentation-api-4-converter/',
              external: true,
            },
            {
              label: t('relatedSpec'),
              href: 'https://iiif.io/api/extension/3d/',
              external: true,
            },
            {
              label: t('relatedSample'),
              href: 'https://iiif.github.io/3d/manifests/9_commenting_annotations/',
              external: true,
            },
          ],
        },
      ]}
    />
  );
}
