'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { VideoEmbed, buttonClass } from '@nakamura196/react-ui';
import { Link } from '@/i18n/routing';
import { hrefOf, sourceOf, thumbnailOf, videoOf, type Locale, type UseCase } from '@/lib/usecases';

const linkClass = 'text-[var(--ds-primary)] hover:underline';

// ユースケース 1 件: 見出し・動画・説明・「Kasane で開く」
export default function UseCaseCard({ useCase: u, locale }: { useCase: UseCase; locale: Locale }) {
  const t = useTranslations('UseCases');
  const videoId = videoOf(u, locale);
  // ownPoster の例は、押されるまで動画を読み込まない
  const [playing, setPlaying] = useState(false);

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
      {videoId && u.ownPoster && !playing ? (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          aria-label={u.title[locale]}
          className="relative mx-auto block w-full max-w-4xl overflow-hidden rounded-xl border border-[var(--ds-border)] bg-black shadow-md"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- 静的書き出しのため next/image は使わない */}
          <img
            src={thumbnailOf(u, locale)}
            alt=""
            width={1280}
            height={720}
            loading="lazy"
            className="aspect-video w-full object-cover"
          />
          <span
            aria-hidden="true"
            className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-black/70 text-3xl text-white">
              ▶
            </span>
          </span>
        </button>
      ) : videoId && u.ownPoster ? (
        // VideoEmbed（react-ui v0.2.0）は autoplay を渡せないので、同じ見た目の iframe を自前で出す
        <div className="mx-auto w-full max-w-4xl overflow-hidden rounded-xl border border-[var(--ds-border)] bg-black shadow-md">
          <iframe
            className="aspect-video w-full"
            src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1`}
            title={u.title[locale]}
            referrerPolicy="strict-origin-when-cross-origin"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      ) : videoId ? (
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
