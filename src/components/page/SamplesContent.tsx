'use client';

import { useLocale, useTranslations } from 'next-intl';
import { contentParam } from '@nakamura196/iiif-viewer/core';
import { Link } from '@/i18n/routing';
import CommonLayout from '@/components/layout/Common';
import { SAMPLES, type Sample } from '@/lib/samples';

const MEDIA_ORDER: Sample['media'][] = ['image', 'audio', 'video', '3d'];

export default function SamplesContent() {
  const t = useTranslations('Samples');
  const locale = useLocale() === 'en' ? 'en' : 'ja';

  const openHref = (s: Sample) =>
    `/viewer?${contentParam(s.manifest)}${s.tab ? `&tab=${s.tab}` : ''}`;

  return (
    <CommonLayout>
      <div className="min-h-[60vh] p-8 bg-[var(--ds-bg)]">
        <div className="max-w-3xl mx-auto space-y-8">
          <div>
            <h1 className="text-2xl font-bold text-[var(--ds-fg)]">{t('title')}</h1>
            <p className="mt-2 text-sm text-[var(--ds-fg-muted)]">{t('lead')}</p>
          </div>
          {MEDIA_ORDER.map((media) => {
            const items = SAMPLES.filter((s) => s.media === media);
            if (items.length === 0) return null;
            return (
              <section key={media}>
                <h2 className="text-lg font-semibold text-[var(--ds-fg)] mb-3">{t(`media.${media}`)}</h2>
                <ul className="space-y-3">
                  {items.map((s) => (
                    <li
                      key={s.id}
                      className="bg-[var(--ds-surface)] rounded-lg border border-[var(--ds-border)] p-4"
                    >
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="font-medium text-[var(--ds-fg)]">{s.title[locale]}</span>
                        <span className="text-xs text-[var(--ds-fg-muted)]">
                          {s.kind === 'cookbook' ? `Cookbook ${s.id}` : t('own')}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-[var(--ds-fg-muted)]">{s.note[locale]}</p>
                      <div className="mt-2 flex flex-wrap gap-4 text-sm">
                        <Link href={openHref(s)} className="text-[var(--ds-primary)] hover:underline">
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
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </CommonLayout>
  );
}
