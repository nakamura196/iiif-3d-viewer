'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import CommonLayout from '@/components/layout/Common';
import PageContainer from '@/components/layout/PageContainer';
import UseCaseCard from '@/components/usecases/UseCaseCard';
import { USE_CASES, USE_CASE_FEATURES, byNewest, type UseCaseFeature } from '@/lib/usecases';

type Order = 'default' | 'newest';

export default function UseCasesContent() {
  const t = useTranslations('UseCases');
  const locale = useLocale() === 'en' ? 'en' : 'ja';
  const [feature, setFeature] = useState<UseCaseFeature | null>(null);
  const [order, setOrder] = useState<Order>('default');

  // 札は、どれかの例に付いているものだけを、決めてある順に出す
  const count = (f: UseCaseFeature) => USE_CASES.filter((u) => u.features.includes(f)).length;
  const features = USE_CASE_FEATURES.filter((f) => count(f) > 0);
  const filtered = feature ? USE_CASES.filter((u) => u.features.includes(feature)) : USE_CASES;
  const items = order === 'newest' ? byNewest(filtered) : filtered;

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
          <h1 className="text-2xl font-bold text-[var(--ds-fg)]">{t('title')}</h1>
          <p className="mt-2 text-sm text-[var(--ds-fg-muted)]">{t('lead')}</p>
        </div>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2" role="group" aria-label={t('filter')}>
            <button
              type="button"
              className={chip(feature === null)}
              aria-pressed={feature === null}
              onClick={() => setFeature(null)}
            >
              {t('all')} ({USE_CASES.length})
            </button>
            {features.map((f) => (
              <button
                key={f}
                type="button"
                className={chip(feature === f)}
                aria-pressed={feature === f}
                onClick={() => setFeature(f)}
              >
                {t(`features.${f}`)} ({count(f)})
              </button>
            ))}
          </div>
          <div
            className="flex flex-wrap items-center gap-2 text-sm"
            role="group"
            aria-label={t('sort')}
          >
            <span className="text-[var(--ds-fg-muted)]">{t('sort')}:</span>
            {(['default', 'newest'] as const).map((o) => (
              <button
                key={o}
                type="button"
                className={chip(order === o)}
                aria-pressed={order === o}
                onClick={() => setOrder(o)}
              >
                {t(o === 'default' ? 'sortDefault' : 'sortNewest')}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {items.map((u) => (
            <UseCaseCard key={u.id} useCase={u} locale={locale} />
          ))}
        </div>
      </PageContainer>
    </CommonLayout>
  );
}
