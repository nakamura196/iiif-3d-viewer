'use client';

import { useTranslations } from 'next-intl';
import { VideoEmbed, buttonClass } from '@nakamura196/react-ui';
import { Link } from '@/i18n/routing';
import { hrefOf, sourceOf, videoOf, type Locale, type UseCase } from '@/lib/usecases';

const linkClass = 'text-[var(--ds-primary)] hover:underline';

// ユースケース 1 件: 見出し・動画・説明・「Kasane で開く」
export default function UseCaseCard({ useCase: u, locale }: { useCase: UseCase; locale: Locale }) {
  const t = useTranslations('UseCases');
  const videoId = videoOf(u, locale);

  return (
    <section
      id={u.id}
      className="scroll-mt-20 bg-[var(--ds-surface)] rounded-lg border border-[var(--ds-border)] p-4 flex flex-col gap-3"
    >
      <h2 className="text-lg font-semibold text-[var(--ds-fg)]">{u.title[locale]}</h2>
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
      {videoId ? (
        <VideoEmbed videoId={videoId} title={u.title[locale]} className="w-full" />
      ) : (
        <div className="aspect-video w-full rounded-xl border border-dashed border-[var(--ds-border)] flex items-center justify-center text-sm text-[var(--ds-fg-muted)]">
          {t('videoPending')}
        </div>
      )}
      <p className="text-sm text-[var(--ds-fg-muted)] flex-1">{u.note[locale]}</p>
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
      <Link href={hrefOf(u.open)} className={`${buttonClass('primary', 'md')} self-start`}>
        {t('open')}
      </Link>
    </section>
  );
}
