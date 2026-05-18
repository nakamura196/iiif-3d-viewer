'use client';

import CommonLayout from '@/components/layout/Common';
import { useTranslations, useLocale } from 'next-intl';

interface ReferenceItem {
  url: string;
  title: { ja: string; en: string };
  description: { ja: string; en: string };
}

interface ReferenceSection {
  headingKey: 'sectionArticles' | 'sectionSpecs' | 'sectionSamples';
  items: ReferenceItem[];
}

const REFERENCE_SECTIONS: ReferenceSection[] = [
  {
    headingKey: 'sectionArticles',
    items: [
      {
        url: 'https://tech.ldas.jp/ja/posts/iiif-3d-viewer-presentation-api-4-converter/',
        title: {
          ja: 'IIIF 3D Viewer：Presentation API 4 コンバーターの実装',
          en: 'IIIF 3D Viewer: Implementing a Presentation API 4 Converter'
        },
        description: {
          ja: '本ビューアの開発背景と、旧来のマニフェストを IIIF Presentation API 4（3D TSG）へ変換する処理についての解説記事。',
          en: 'An article on the background of this viewer and the conversion of legacy manifests to the IIIF Presentation API 4 (3D TSG).'
        }
      }
    ]
  },
  {
    headingKey: 'sectionSpecs',
    items: [
      {
        url: 'https://iiif.io/api/extension/3d/',
        title: { ja: 'IIIF 3D Extension', en: 'IIIF 3D Extension' },
        description: {
          ja: 'IIIF Presentation API において 3D コンテンツを表現するための拡張仕様。',
          en: 'The extension specification for representing 3D content in the IIIF Presentation API.'
        }
      }
    ]
  },
  {
    headingKey: 'sectionSamples',
    items: [
      {
        url: 'https://iiif.github.io/3d/manifests/9_commenting_annotations/',
        title: {
          ja: 'Commenting Annotations サンプル',
          en: 'Commenting Annotations Sample'
        },
        description: {
          ja: 'IIIF 3D TSG が公開する、3D モデルにコメントアノテーションを付与したマニフェストの例。',
          en: 'An example manifest with commenting annotations on a 3D model, published by the IIIF 3D TSG.'
        }
      }
    ]
  }
];

export default function ReferencesContent() {
  const t = useTranslations('References');
  const locale = useLocale();
  const lang = locale === 'en' ? 'en' : 'ja';

  return (
    <CommonLayout>
      <div className="min-h-[60vh] p-8 bg-white dark:bg-gray-900">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 p-8">
            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-4">
              {t('title')}
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mb-6">{t('intro')}</p>

            {REFERENCE_SECTIONS.map((section) => (
              <section key={section.headingKey} className="mt-8">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-3">
                  {t(section.headingKey)}
                </h2>
                <ul className="space-y-3">
                  {section.items.map((item) => (
                    <li key={item.url}>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block rounded-lg border border-gray-200 dark:border-gray-700 p-4 transition-colors duration-200 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-900/20"
                      >
                        <span className="flex items-center font-medium text-blue-600 dark:text-blue-400">
                          {item.title[lang]}
                          <svg
                            className="ml-1.5 w-4 h-4 flex-shrink-0"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                            />
                          </svg>
                        </span>
                        <span className="mt-1 block text-sm text-gray-600 dark:text-gray-300">
                          {item.description[lang]}
                        </span>
                        <span className="mt-1 block break-all text-xs text-gray-400 dark:text-gray-500">
                          {item.url}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      </div>
    </CommonLayout>
  );
}
