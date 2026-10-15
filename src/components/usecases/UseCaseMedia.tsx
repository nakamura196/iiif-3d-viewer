'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { VideoEmbed } from '@nakamura196/react-ui';
import { thumbnailOf, videoOf, type Locale, type UseCase } from '@/lib/usecases';

// ユースケースの動画の枠。一覧のカードと詳細ページの両方で使う。
// ownPoster なら Kasane の画面を出して、押したら再生。動画が無ければ「準備中」
export default function UseCaseMedia({ useCase: u, locale }: { useCase: UseCase; locale: Locale }) {
  const t = useTranslations('UseCases');
  const videoId = videoOf(u, locale);
  // ownPoster の例は、押されるまで動画を読み込まない
  const [playing, setPlaying] = useState(false);

  if (videoId && u.ownPoster && !playing) {
    return (
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
    );
  }
  if (videoId && u.ownPoster) {
    // VideoEmbed（react-ui v0.2.0）は autoplay を渡せないので、同じ見た目の iframe を自前で出す
    return (
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
    );
  }
  if (videoId) return <VideoEmbed videoId={videoId} title={u.title[locale]} className="w-full" />;
  return (
    <div className="aspect-video w-full rounded-xl border border-dashed border-[var(--ds-border)] flex items-center justify-center text-sm text-[var(--ds-fg-muted)]">
      {t('videoPending')}
    </div>
  );
}
