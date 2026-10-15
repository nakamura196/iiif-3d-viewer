'use client';

import { useLocale, useTranslations } from 'next-intl';
import { buttonClass } from '@nakamura196/react-ui';
import { Link } from '@/i18n/routing';
import CommonLayout from '@/components/layout/Common';
import PageContainer from '@/components/layout/PageContainer';
import CopyLinkButton from '@/components/page/CopyLinkButton';
import UseCaseMedia from '@/components/usecases/UseCaseMedia';
import { newsAboutUseCase } from '@/lib/news';
import { USE_CASES, hrefOf, sourceOf, thumbnailOf, usecaseById } from '@/lib/usecases';

const linkClass = 'text-[var(--ds-primary)] hover:underline';

// /usecases/<id>: ユースケース 1 件。URL を共有する先として、題名・札・動画・説明・リンク・ほかの例を出す
export default function UseCaseDetailContent({ id }: { id: string }) {
  const t = useTranslations('UseCases');
  const locale = useLocale() === 'en' ? 'en' : 'ja';
  const u = usecaseById(id);
  if (!u) return null;

  const others = USE_CASES.filter((x) => x.id !== u.id);
  const news = newsAboutUseCase(u.id);

  return (
    <CommonLayout>
      <PageContainer width="text" className="space-y-8">
        <p className="text-sm">
          <Link href="/usecases" className={linkClass}>
            ← {t('back')}
          </Link>
        </p>
        <header className="space-y-3">
          <h1 className="text-2xl font-bold text-[var(--ds-fg)]">{u.title[locale]}</h1>
          <ul className="flex flex-wrap gap-2">
            {u.features.map((f) => (
              <li
                key={f}
                className="text-xs px-2 py-0.5 rounded-full border border-[var(--ds-border)] text-[var(--ds-fg-muted)]"
              >
                {t(`features.${f}`)}
              </li>
            ))}
          </ul>
        </header>

        <UseCaseMedia useCase={u} locale={locale} />

        <p className="leading-relaxed text-[var(--ds-fg)]">{u.note[locale]}</p>

        <div className="flex flex-wrap items-center gap-4 text-sm">
          <a href={sourceOf(u.open)} target="_blank" rel="noopener noreferrer" className={linkClass}>
            {t('manifest')}
          </a>
          {u.site && (
            <a href={u.site} target="_blank" rel="noopener noreferrer" className={linkClass}>
              {t('site')}
            </a>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link href={hrefOf(u.open)} className={buttonClass('primary', 'md')}>
            {t('open')}
          </Link>
          <CopyLinkButton label={t('copyLink')} done={t('copied')} />
        </div>

        {news.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-[var(--ds-fg)]">{t('newsHeading')}</h2>
            <ul className="space-y-1 text-sm">
              {news.map((n) => (
                <li key={n.id}>
                  <Link href={`/news/${n.id}`} className={linkClass}>
                    {n.title[locale]}
                  </Link>
                  <time className="ml-2 tabular-nums text-[var(--ds-fg-muted)]">{n.date}</time>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-[var(--ds-fg)]">{t('others')}</h2>
          <ul className="grid gap-4 sm:grid-cols-2">
            {others.map((o) => (
              <li key={o.id}>
                <Link href={`/usecases/${o.id}`} className="group block space-y-2">
                  {/* eslint-disable-next-line @next/next/no-img-element -- 静的書き出しなので next/image の最適化は使えない */}
                  <img
                    src={thumbnailOf(o, locale)}
                    alt=""
                    loading="lazy"
                    className="w-full rounded-lg border border-[var(--ds-border)]"
                  />
                  <span className="block text-sm text-[var(--ds-primary)] group-hover:underline">
                    {o.title[locale]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </PageContainer>
    </CommonLayout>
  );
}
