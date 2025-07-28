'use client';

import CommonLayout from '@/components/layout/Common';
import { useTranslations } from 'next-intl';

export default function HelpContent() {
  const t = useTranslations('Help');

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
                d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-2">{t('title')}</h1>
          <p className="text-gray-600 dark:text-gray-300 max-w-lg mx-auto">
            当サービスのヘルプページは現在作成中です。
            より良いサービスをご提供するため、準備を進めています。
          </p>
        </div>

        {/* 予定セクション */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 p-6 max-w-2xl w-full">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
            記載予定の内容
          </h2>
          <ul className="space-y-3">
            {[
              '基本的な使い方',
              '3Dモデルの操作方法',
              'アノテーションの追加と編集',
              'よくある質問（FAQ）',
              'トラブルシューティング',
              'システム要件',
              'お問い合わせ方法',
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
            ヘルプページの詳細は準備が整い次第、こちらに掲載いたします。
            <br />
            ご不明な点がございましたら、管理者までお問い合わせください。
          </p>
        </div>
      </div>
    </CommonLayout>
  );
}