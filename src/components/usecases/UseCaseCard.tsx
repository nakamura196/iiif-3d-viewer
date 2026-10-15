'use client';

import { useTranslations } from 'next-intl';
import { buttonClass } from '@nakamura196/react-ui';
import { Link } from '@/i18n/routing';
import UseCaseMedia from '@/components/usecases/UseCaseMedia';
import { hrefOf, sourcesOf, type Locale, type UseCase } from '@/lib/usecases';

const linkClass = 'text-[var(--ds-primary)] hover:underline';

// ユースケース 1 件（一覧用）: 動画・見出し・説明・「Kasane で開く」。動画を頭に置くのは、見出しの行数が違っても並んだカードで動画の位置が揃うように。見出しと「詳しく見る」は詳細ページへ
export default function UseCaseCard({ useCase: u, locale }: { useCase: UseCase; locale: Locale }) {
  const t = useTranslations('UseCases');

  return (
    <section
      id={u.id}
      className="scroll-mt-20 overflow-hidden bg-[var(--ds-surface)] rounded-lg border border-[var(--ds-border)] p-4 flex flex-col gap-3"
    >
      {/* 動画はカードの縁いっぱいに出す（カードの余白を打ち消し、動画側の角丸・枠・影を外す） */}
      <div className="-mx-4 -mt-4 [&>*]:max-w-none [&>*]:rounded-none [&>*]:border-0 [&>*]:shadow-none">
        <UseCaseMedia useCase={u} locale={locale} />
      </div>
      <h2 className="text-lg font-semibold text-[var(--ds-fg)]">
        <Link href={`/usecases/${u.id}`} className="hover:text-[var(--ds-primary)] hover:underline">
          {u.title[locale]}
        </Link>
      </h2>
      <div className="flex flex-wrap items-center gap-2">
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
        <span className="ml-auto text-xs text-[var(--ds-fg-muted)]">
          {t('added')} <time dateTime={u.added}>{u.added}</time>
        </span>
      </div>
      <p className="text-sm text-[var(--ds-fg-muted)] flex-1">{u.note[locale]}</p>
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <Link href={`/usecases/${u.id}`} className={linkClass}>
          {t('details')}
        </Link>
        {sourcesOf(u.open).map((s, i, all) => (
          <a key={s} href={s} target="_blank" rel="noopener noreferrer" className={linkClass}>
            {t('manifest')}
            {all.length > 1 && ` ${i + 1}`}
          </a>
        ))}
        {u.site && (
          <a href={u.site} target="_blank" rel="noopener noreferrer" className={linkClass}>
            {t('site')}
          </a>
        )}
      </div>
      <Link href={hrefOf(u.open)} className={`${buttonClass('primary', 'md')} self-start`}>
        {t('open')}
      </Link>
    </section>
  );
}
