'use client';

import { useLocale, useTranslations } from 'next-intl';
import { VideoEmbed, buttonClass } from '@nakamura196/react-ui';
import { Link } from '@/i18n/routing';
import CommonLayout from '@/components/layout/Common';
import PageContainer from '@/components/layout/PageContainer';
import { actionHrefOf, newsById, newsVideoOf, relatedUseCasesOf } from '@/lib/news';
import { thumbnailOf } from '@/lib/usecases';

const linkClass = 'text-[var(--ds-primary)] hover:underline';

// /news/<id>: お知らせ 1 件。見出し・日付・動画（無ければ関連ユースケースの画像）・本文・「試す」・関連ユースケース
export default function NewsDetailContent({ id }: { id: string }) {
  const t = useTranslations('News');
  const locale = useLocale() === 'en' ? 'en' : 'ja';
  const n = newsById(id);
  if (!n) return null;

  const videoId = newsVideoOf(n, locale);
  const related = relatedUseCasesOf(n);
  const cover = !videoId ? related[0] : undefined;
  const action = n.action;

  return (
    <CommonLayout>
      <PageContainer width="text" className="space-y-8">
        <p className="text-sm">
          <Link href="/news" className={linkClass}>
            ← {t('back')}
          </Link>
        </p>
        <header className="space-y-2">
          <time className="text-sm tabular-nums text-[var(--ds-fg-muted)]">{n.date}</time>
          <h1 className="text-2xl font-bold text-[var(--ds-fg)]">{n.title[locale]}</h1>
        </header>

        {videoId && <VideoEmbed videoId={videoId} title={n.title[locale]} className="w-full" />}
        {cover && (
          // eslint-disable-next-line @next/next/no-img-element -- 静的書き出しなので next/image の最適化は使えない
          <img
            src={thumbnailOf(cover, locale)}
            alt={cover.title[locale]}
            className="w-full rounded-lg border border-[var(--ds-border)]"
          />
        )}

        <p className="leading-relaxed text-[var(--ds-fg)]">{n.body[locale]}</p>

        {action &&
          (action.external ? (
            <a
              href={actionHrefOf(action, locale)}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClass('primary', 'md')}
            >
              {t(action.label ?? 'tryIt')}
            </a>
          ) : (
            <Link href={actionHrefOf(action, locale)} className={buttonClass('primary', 'md')}>
              {t(action.label ?? 'tryIt')}
            </Link>
          ))}

        {related.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-[var(--ds-fg)]">{t('related')}</h2>
            <ul className="grid gap-4 sm:grid-cols-2">
              {related.map((u) => (
                <li key={u.id}>
                  <Link href={`/usecases#${u.id}`} className="group block space-y-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={thumbnailOf(u, locale)}
                      alt=""
                      className="w-full rounded-lg border border-[var(--ds-border)]"
                    />
                    <span className="block text-sm text-[var(--ds-primary)] group-hover:underline">
                      {u.title[locale]}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </PageContainer>
    </CommonLayout>
  );
}
