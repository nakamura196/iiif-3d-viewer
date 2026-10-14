'use client';

import { useLocale, useTranslations } from 'next-intl';
import CommonLayout from '@/components/layout/Common';
import UseCaseCard from '@/components/usecases/UseCaseCard';
import { USE_CASES } from '@/lib/usecases';

export default function UseCasesContent() {
  const t = useTranslations('UseCases');
  const locale = useLocale() === 'en' ? 'en' : 'ja';

  return (
    <CommonLayout>
      <div className="min-h-[60vh] p-8 bg-[var(--ds-bg)]">
        <div className="max-w-6xl mx-auto space-y-8">
          <div>
            <h1 className="text-2xl font-bold text-[var(--ds-fg)]">{t('title')}</h1>
            <p className="mt-2 text-sm text-[var(--ds-fg-muted)]">{t('lead')}</p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {USE_CASES.map((u) => (
              <UseCaseCard key={u.id} useCase={u} locale={locale} />
            ))}
          </div>
        </div>
      </div>
    </CommonLayout>
  );
}
