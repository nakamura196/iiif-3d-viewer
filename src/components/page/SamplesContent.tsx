'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import CommonLayout from '@/components/layout/Common';
import PageContainer from '@/components/layout/PageContainer';
import { VideoEmbed } from '@nakamura196/react-ui';
import { SAMPLES, sampleHref, sampleThumbnail, type Sample, type SampleKind } from '@/lib/samples';

// 3D（アノテーションつき）が Kasane の中心の機能なので先に出す
const MEDIA_ORDER: Sample['media'][] = ['3d', 'image', 'audio', 'video'];

// 一覧ページの置き場所。Cookbook のレシピと Kasane 独自のマニフェストを別のページにする
export const SAMPLE_PAGES: Record<SampleKind, string> = {
  cookbook: '/samples',
  own: '/samples/kasane',
};

// Cookbook のレシピを Kasane で開いて確かめた動画（全レシピを 1 本につないだもの、YouTube の videoId）。
// 未公開のあいだは null で、ページには出さない
const COOKBOOK_VIDEO_ID: string | null = null;

export default function SamplesContent({ kind }: { kind: SampleKind }) {
  const t = useTranslations('Samples');
  const locale = useLocale() === 'en' ? 'en' : 'ja';
  const other: SampleKind = kind === 'cookbook' ? 'own' : 'cookbook';

  return (
    <CommonLayout>
      <PageContainer className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--ds-fg)]">{t(`${kind}.title`)}</h1>
          <p className="mt-2 text-sm text-[var(--ds-fg-muted)]">{t(`${kind}.lead`)}</p>
          <p className="mt-2 text-sm">
            <Link href={SAMPLE_PAGES[other]} className="text-[var(--ds-primary)] hover:underline">
              {t(`${kind}.link`)}
            </Link>
          </p>
        </div>
        {kind === 'cookbook' && COOKBOOK_VIDEO_ID && (
          <section>
            <h2 className="text-lg font-semibold text-[var(--ds-fg)] mb-3">{t('cookbook.videoHeading')}</h2>
            <p className="mb-3 text-sm text-[var(--ds-fg-muted)]">{t('cookbook.videoLead')}</p>
            <VideoEmbed videoId={COOKBOOK_VIDEO_ID} title={t('cookbook.videoHeading')} />
          </section>
        )}
        {MEDIA_ORDER.map((media) => {
          const items = SAMPLES.filter((s) => s.kind === kind && s.media === media);
          if (items.length === 0) return null;
          return (
            <section key={media}>
              <h2 className="text-lg font-semibold text-[var(--ds-fg)] mb-3">{t(`media.${media}`)}</h2>
              <ul className="grid gap-3 lg:grid-cols-2">
                {items.map((s) => (
                  <li
                    key={s.id}
                    className="bg-[var(--ds-surface)] rounded-lg border border-[var(--ds-border)] p-4 flex flex-col sm:flex-row gap-4"
                  >
                    {/* 開いたときの画面。押すと開く */}
                    <Link href={sampleHref(s)} className="shrink-0 sm:w-48" tabIndex={-1} aria-hidden="true">
                      {/* eslint-disable-next-line @next/next/no-img-element -- 静的書き出しのため next/image は使わない */}
                      <img
                        src={sampleThumbnail(s)}
                        alt=""
                        width={640}
                        height={400}
                        loading="lazy"
                        className="w-full aspect-[16/10] object-cover rounded border border-[var(--ds-border)] bg-[var(--ds-surface-2)]"
                      />
                    </Link>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="font-medium text-[var(--ds-fg)]">{s.title[locale]}</span>
                        {s.kind === 'cookbook' && (
                          <span className="text-xs text-[var(--ds-fg-muted)]">Cookbook {s.id}</span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-[var(--ds-fg-muted)]">{s.note[locale]}</p>
                      <div className="mt-2 flex flex-wrap gap-4 text-sm">
                        <Link href={sampleHref(s)} className="text-[var(--ds-primary)] hover:underline">
                          {t('open')}
                        </Link>
                        <a
                          href={s.manifest}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[var(--ds-primary)] hover:underline"
                        >
                          {t('manifest')}
                        </a>
                        {s.source && (
                          <a
                            href={s.source}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[var(--ds-primary)] hover:underline"
                          >
                            {t('recipe')}
                          </a>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </PageContainer>
    </CommonLayout>
  );
}
