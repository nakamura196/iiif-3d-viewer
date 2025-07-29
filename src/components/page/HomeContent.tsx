'use client';

import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ManifestInput from '@/components/Input';

export default function HomeContent() {
  const router = useRouter();
  const t = useTranslations('Home');
  const locale = useLocale();

  const handleManifestSubmit = async (manifestUrl: string, tab?: string) => {
    const url = `/${locale}/viewer?manifest=${encodeURIComponent(manifestUrl)}`;
    router.push(tab ? `${url}&tab=${tab}` : url);
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-4xl mx-auto">
            <section className="text-center mb-16">
              <h1 className="text-4xl md:text-5xl font-bold text-gray-800 dark:text-gray-100 mb-6">
                {t('title')}
              </h1>
              <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300 mb-8">
                {t('subtitle')}
              </p>
            </section>

            <section className="mb-16">
              <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-6 text-center">
                {t('features')}
              </h2>
              <div className="grid md:grid-cols-3 gap-8">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                  <div className="text-blue-500 mb-4">
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
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-100">
                    {t('feature1Title')}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300">
                    {t('feature1Description')}
                  </p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                  <div className="text-blue-500 mb-4">
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
                        d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-100">
                    {t('feature2Title')}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300">
                    {t('feature2Description')}
                  </p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                  <div className="text-blue-500 mb-4">
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
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-100">
                    {t('feature3Title')}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300">
                    {t('feature3Description')}
                  </p>
                </div>
              </div>
            </section>

            <section className="bg-gray-50 dark:bg-gray-800 p-8 rounded-lg">
              <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-6 text-center">
                {t('howToUse')}
              </h2>
              <div className="space-y-4 text-gray-600 dark:text-gray-300">
                <p>{t('step1')}</p>
                <p>{t('step2')}</p>
                <p>{t('step3')}</p>
                <p>{t('step4')}</p>
              </div>
            </section>

            <section className="mt-16">
              <ManifestInput onSubmit={handleManifestSubmit} />
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}