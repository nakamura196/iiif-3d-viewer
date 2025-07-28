'use client';

import CommonLayout from '@/components/layout/Common';
import { useTranslations } from 'next-intl';

export default function TermsContent() {
  const t = useTranslations('Terms');

  return (
    <CommonLayout>
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 bg-white dark:bg-gray-900">
        {/* アイコンと見出し */}
        <div className="mb-8 text-center">
          <div className="inline-block p-4 bg-blue-50 dark:bg-blue-900 rounded-full mb-4">
            <svg
              className="w-16 h-16 text-blue-500 dark:text-blue-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-2">{t('title')}</h1>
          <p className="text-gray-600 dark:text-gray-300 max-w-lg mx-auto">
            当サービスの利用規約は現在作成中です。
            ユーザーの皆様に安心してご利用いただけるよう、明確な利用条件を準備しています。
          </p>
        </div>

        {/* 予定セクション */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 p-6 max-w-2xl w-full">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
            記載予定の内容
          </h2>
          <ul className="space-y-3">
            {[
              'サービスの利用条件',
              '禁止事項',
              '知的財産権について',
              '免責事項',
              'アカウントの管理',
              'サービスの変更・停止',
              '利用規約の変更',
              '準拠法・管轄裁判所',
            ].map((item, index) => (
              <li key={index} className="flex items-center text-gray-600 dark:text-gray-300">
                <svg
                  className="w-5 h-5 text-blue-500 dark:text-blue-400 mr-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* 注意書き */}
        <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>
            利用規約の詳細は準備が整い次第、こちらに掲載いたします。
            <br />
            なお、サービスのご利用開始をもって、利用規約に同意したものとみなされます。
          </p>
        </div>
      </div>
    </CommonLayout>
  );
}