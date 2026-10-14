'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import CommonLayout from '@/components/layout/Common';
import PageContainer from '@/components/layout/PageContainer';
import { VideoEmbed } from '@nakamura196/react-ui';
import { COOKBOOK_VIDEO_ID, cookbookVideoUrl } from '@/lib/cookbookVideo';
import {
  COOKBOOK_CATEGORIES,
  COOKBOOK_RECIPES,
  recipeHref,
  recipePage,
  type CookbookCategory,
  type CookbookRecipe,
} from '@/lib/cookbookRecipes';
import { SAMPLE_PAGES } from '@/components/page/SamplesContent';

const linkClass = 'text-[var(--ds-primary)] hover:underline';

// 動画のチャプターは 1 レシピに 1 つ。最初に開くマニフェストで引く
const videoUrl = (r: CookbookRecipe): string | null => {
  const url = r.links[0]?.url;
  return url ? cookbookVideoUrl(r.id, url) : null;
};

export default function CookbookSamplesContent() {
  const t = useTranslations('Samples');
  const locale = useLocale() === 'en' ? 'en' : 'ja';
  const [category, setCategory] = useState<CookbookCategory | null>(null);

  const items = category ? COOKBOOK_RECIPES.filter((r) => r.category === category) : COOKBOOK_RECIPES;
  const count = (c: CookbookCategory) => COOKBOOK_RECIPES.filter((r) => r.category === c).length;

  const chip = (active: boolean) =>
    `px-3 py-1 rounded-full border text-sm ${
      active
        ? 'bg-[var(--ds-primary)] border-[var(--ds-primary)] text-white'
        : 'bg-[var(--ds-surface)] border-[var(--ds-border)] text-[var(--ds-fg)] hover:border-[var(--ds-primary)]'
    }`;

  return (
    <CommonLayout>
      <PageContainer className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--ds-fg)]">{t('cookbook.title')}</h1>
          <p className="mt-2 text-sm text-[var(--ds-fg-muted)]">{t('cookbook.lead')}</p>
          <p className="mt-2 text-sm">
            <Link href={SAMPLE_PAGES.own} className={linkClass}>
              {t('cookbook.link')}
            </Link>
          </p>
        </div>

        <section>
          <h2 className="text-lg font-semibold text-[var(--ds-fg)] mb-3">{t('cookbook.videoHeading')}</h2>
          <p className="mb-3 text-sm text-[var(--ds-fg-muted)]">{t('cookbook.videoLead')}</p>
          <VideoEmbed videoId={COOKBOOK_VIDEO_ID} title={t('cookbook.videoHeading')} />
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--ds-fg)] mb-3">{t('cookbook.listHeading')}</h2>
          {/* Cookbook の目次のカテゴリで絞り込む */}
          <div className="flex flex-wrap gap-2" role="group" aria-label={t('cookbook.filter')}>
            <button type="button" className={chip(category === null)} aria-pressed={category === null} onClick={() => setCategory(null)}>
              {t('cookbook.all')} ({COOKBOOK_RECIPES.length})
            </button>
            {COOKBOOK_CATEGORIES.map((c) => (
              <button key={c} type="button" className={chip(category === c)} aria-pressed={category === c} onClick={() => setCategory(c)}>
                {t(`category.${c}`)} ({count(c)})
              </button>
            ))}
          </div>

          <ul className="mt-4 divide-y divide-[var(--ds-border)] border-y border-[var(--ds-border)]">
            {items.map((r) => {
              const video = videoUrl(r);
              return (
                <li key={r.id} className="py-3 flex gap-4">
                  <span className="shrink-0 w-12 font-mono text-sm text-[var(--ds-fg-muted)] pt-0.5">{r.id}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span className="font-medium text-[var(--ds-fg)]">{r.title[locale]}</span>
                      {locale === 'ja' && <span className="text-xs text-[var(--ds-fg-muted)]">{r.title.en}</span>}
                      {r.status !== 'checked' && (
                        <span className="text-xs px-2 py-0.5 rounded bg-[var(--ds-surface-2)] text-[var(--ds-fg-muted)]">
                          {t(`status.${r.status}`)}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-[var(--ds-fg-muted)]">{t(`category.${r.category}`)}</div>
                    {r.note && <p className="mt-1 text-sm text-[var(--ds-fg-muted)]">{r.note[locale]}</p>}
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                      {r.links.map((link, i) => (
                        <span key={i} className="inline-flex gap-1.5">
                          <Link href={recipeHref(r, link)} className={linkClass}>
                            {link.label ? t('openWith', { label: link.label }) : t('open')}
                          </Link>
                          {link.url && (
                            <a href={link.url} target="_blank" rel="noopener noreferrer" className={`${linkClass} text-xs self-center`}>
                              JSON
                            </a>
                          )}
                        </span>
                      ))}
                      {video && (
                        <a href={video} target="_blank" rel="noopener noreferrer" className={linkClass}>
                          {t('video')}
                        </a>
                      )}
                      <a href={recipePage(r.id)} target="_blank" rel="noopener noreferrer" className={linkClass}>
                        {t('recipe')}
                      </a>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </PageContainer>
    </CommonLayout>
  );
}
