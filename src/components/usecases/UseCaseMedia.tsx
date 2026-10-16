'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { thumbnailOf, videoOf, type Locale, type UseCase } from '@/lib/usecases';

// ユースケースの動画の枠。一覧のカードと詳細ページの両方で使う。
// 動画があれば Kasane の画面に ▶ を重ねて出し、押したらその場で再生する。動画が無ければ「準備中」。
// YouTube の埋め込みを最初から並べると、1 本ごとに再生用のプログラムを読み込んで重くなり、
// YouTube 側の題名やロゴが重なってカードの見た目もそろわないため
export default function UseCaseMedia({ useCase: u, locale }: { useCase: UseCase; locale: Locale }) {
  const t = useTranslations('UseCases');
  const videoId = videoOf(u, locale);
  // 押されるまで YouTube は読み込まない
  const [playing, setPlaying] = useState(false);

  if (videoId && !playing) {
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
  if (videoId) {
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
  return (
    <div className="aspect-video w-full rounded-xl border border-dashed border-[var(--ds-border)] flex items-center justify-center text-sm text-[var(--ds-fg-muted)]">
      {t('videoPending')}
    </div>
  );
}
