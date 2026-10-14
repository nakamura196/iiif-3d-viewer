'use client';

import { Link } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import { Footer as DsFooter } from '@nakamura196/react-ui';

// 共有デザインシステム (@nakamura196/react-ui) の4列フッター。
// 左ブロック (title + description) ＋ columns (最大3列) = 計4列。
// next-intl の Link を LinkComponent に渡してロケール付きリンクを描画する。
// 個々の資料へのリンクは置かず、例の一覧（/usecases）・Cookbook の対応表（/samples）・検索への入口だけを置く。
// Shared Region and Keyed Tag Extension の例（public/manifests/sample-manifest-region-tags.json）は
// 研究段階のため公開ページには出さない（掲載の了承が得られたら /usecases に足す）

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
        // 3列目: サンプル（ユースケース・Cookbook のサンプル一覧・検索）
        {
          heading: t('samplesHeading'),
          links: [
            { label: t('useCasesAll'), href: '/usecases' },
            { label: t('samplesAll'), href: '/samples' },
            { label: t('samplesOwn'), href: '/samples/kasane' },
            { label: t('search'), href: '/search' },
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
            {
              // nakamura196 が公開している他のツール一覧 (academicpages portfolio)
              label: t('relatedOtherTools'),
              href: 'https://nakamura196.github.io/portfolio/',
              external: true,
            },
          ],
        },
      ]}
    />
  );
}
