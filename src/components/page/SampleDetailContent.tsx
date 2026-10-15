'use client';

import { useLocale, useTranslations } from 'next-intl';
import { buttonClass } from '@nakamura196/react-ui';
import { Link } from '@/i18n/routing';
import CommonLayout from '@/components/layout/Common';
import PageContainer from '@/components/layout/PageContainer';
import CopyLinkButton from '@/components/page/CopyLinkButton';
import { SAMPLES, sampleById, sampleHref, sampleThumbnail } from '@/lib/samples';

const linkClass = 'text-[var(--ds-primary)] hover:underline';

// /samples/<id>: Kasane 独自のサンプル 1 件。画像・説明・マニフェスト・「ビューアで開く」・ほかのサンプル
export default function SampleDetailContent({ id }: { id: string }) {
  const t = useTranslations('Samples');
  const locale = useLocale() === 'en' ? 'en' : 'ja';
  const s = sampleById(id);
  if (!s) return null;

  // 数が少ないので、分類で絞らず自分以外をすべて出す
  const others = SAMPLES.filter((x) => x.id !== s.id);

  return (
    <CommonLayout>
      <PageContainer width="text" className="space-y-8">
        <p className="text-sm">
          <Link href="/samples/kasane" className={linkClass}>
            ← {t('back')}
          </Link>
        </p>
        <header className="space-y-3">
          <h1 className="text-2xl font-bold text-[var(--ds-fg)]">{s.title[locale]}</h1>
          <span className="inline-block text-xs px-2 py-0.5 rounded-full border border-[var(--ds-border)] text-[var(--ds-fg-muted)]">
            {t(`media.${s.media}`)}
          </span>
        </header>

        {/* eslint-disable-next-line @next/next/no-img-element -- 静的書き出しなので next/image の最適化は使えない */}
        <img
          src={sampleThumbnail(s)}
          alt=""
          width={640}
          height={400}
          className="w-full rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-2)]"
        />

        <p className="leading-relaxed text-[var(--ds-fg)]">{s.note[locale]}</p>

        <div className="text-sm">
          <a href={s.manifest} target="_blank" rel="noopener noreferrer" className={linkClass}>
            {t('manifest')}
          </a>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link href={sampleHref(s)} className={buttonClass('primary', 'md')}>
            {t('open')}
          </Link>
          <CopyLinkButton label={t('copyLink')} done={t('copied')} />
        </div>

        {others.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-[var(--ds-fg)]">{t('others')}</h2>
            <ul className="grid gap-4 sm:grid-cols-2">
              {others.map((o) => (
                <li key={o.id}>
                  <Link href={`/samples/${o.id}`} className="group block space-y-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={sampleThumbnail(o)}
                      alt=""
                      loading="lazy"
                      className="w-full rounded-lg border border-[var(--ds-border)]"
                    />
                    <span className="block text-sm text-[var(--ds-primary)] group-hover:underline">
                      {o.title[locale]}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </PageContainer>
    </CommonLayout>
  );
}
