'use client';

import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/routing';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ManifestInput from '@/components/Input';
import { SectionHeading, News, VideoEmbed } from '@nakamura196/react-ui';

export default function HomeContent() {
  const router = useRouter();
  const t = useTranslations('Home');
  const tNews = useTranslations('News');
  const locale = useLocale();

  const newsItems = [
    {
      date: tNews('item1Date'),
      title: tNews('item1Title'),
      href: 'https://tech.ldas.jp/ja/posts/iiif-3d-viewer-presentation-api-4-converter/',
      external: true,
    },
  ];

  const steps = ['step1', 'step2', 'step3', 'step4'] as const;

  // ロケール別のデモ動画（YouTube videoId）。日本語版 / 英語版を出し分ける。
  const demoVideoId = locale === 'en' ? 'Wbhqz5s6ahA' : '_thPJDU_hLA';

  const handleManifestSubmit = async (manifestUrl: string, tab?: string) => {
    const url = `/${locale}/viewer?manifest=${encodeURIComponent(manifestUrl)}`;
    router.push(tab ? `${url}&tab=${tab}` : url);
  };

  const featureCards = [
    {
      titleKey: 'feature1Title',
      descKey: 'feature1Description',
      path: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z',
    },
    {
      titleKey: 'feature2Title',
      descKey: 'feature2Description',
      path: 'M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z',
    },
    {
      titleKey: 'feature3Title',
      descKey: 'feature3Description',
      path: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    },
  ] as const;

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-4xl mx-auto">
            <section className="text-center mb-16">
              <h1
                className="text-4xl md:text-5xl font-bold text-[var(--ds-fg)] mb-6"
                style={{ fontFamily: 'var(--ds-font-serif)' }}
              >
                {t('title')}
              </h1>
              <p className="text-lg md:text-xl text-[var(--ds-fg-muted)] mb-8">
                {t('subtitle')}
              </p>
            </section>

            <section className="mb-16">
              <VideoEmbed videoId={demoVideoId} title={t('title')} />
            </section>

            <section className="mb-16">
              <ManifestInput onSubmit={handleManifestSubmit} />
            </section>

            <News
              heading={tNews('heading')}
              items={newsItems}
              emptyText={tNews('empty')}
              LinkComponent={Link}
              className="mb-16 !px-0 !py-0"
            />

            <section className="mb-16">
              <SectionHeading>{t('features')}</SectionHeading>
              <div className="grid md:grid-cols-3 gap-8">
                {featureCards.map((card) => (
                  <div
                    key={card.titleKey}
                    className="bg-[var(--ds-surface)] border border-[var(--ds-border)] p-6 rounded-lg shadow-md"
                  >
                    <div className="text-[var(--ds-primary)] mb-4">
                      <svg
                        className="w-12 h-12"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d={card.path}
                        />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold mb-2 text-[var(--ds-fg)]">
                      {t(card.titleKey)}
                    </h3>
                    <p className="text-[var(--ds-fg-muted)]">
                      {t(card.descKey)}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="mb-16">
              <SectionHeading>{t('howToUse')}</SectionHeading>
              <div className="grid md:grid-cols-2 gap-8">
                {steps.map((step) => (
                  <div
                    key={step}
                    className="bg-[var(--ds-surface)] border border-[var(--ds-border)] p-6 rounded-lg shadow-md text-[var(--ds-fg-muted)]"
                  >
                    {t(step)}
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
