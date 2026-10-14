'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import CommonLayout from '@/components/layout/Common';
import PageContainer from '@/components/layout/PageContainer';
import { NEWS } from '@/lib/news';

// /news: お知らせの全件。各項目は詳細ページ（/news/<id>）へ
export default function NewsListContent() {
  const t = useTranslations('News');
  const locale = useLocale() === 'en' ? 'en' : 'ja';

  return (
    <CommonLayout>
      <PageContainer className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--ds-fg)]">{t('heading')}</h1>
          <p className="mt-2 text-sm text-[var(--ds-fg-muted)]">{t('listLead')}</p>
        </div>
        {/* 見た目はトップのお知らせ（react-ui の News）とそろえる。見出しは h1 にしたいので一覧だけ自前で書く */}
        <ul className="divide-y divide-[var(--ds-border)] border-y border-[var(--ds-border)]">
          {NEWS.map((n) => (
            <li key={n.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:gap-4">
              <time className="shrink-0 text-sm tabular-nums text-[var(--ds-fg-muted)]">{n.date}</time>
              <Link href={`/news/${n.id}`} className="text-[var(--ds-primary)] hover:underline">
                {n.title[locale]}
              </Link>
            </li>
          ))}
        </ul>
      </PageContainer>
    </CommonLayout>
  );
}
