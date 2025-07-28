'use client';

import CommonLayout from '@/components/layout/Common';
import { useTranslations } from 'next-intl';

export default function PrivacyContent() {
  const t = useTranslations('Privacy');

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
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-2">{t('title')}</h1>
          <p className="text-gray-600 dark:text-gray-300 max-w-lg mx-auto">
            当サービスのプライバシーポリシーは現在作成中です。
            ユーザーの皆様の個人情報保護に努めています。
          </p>
        </div>

        {/* 予定セクション */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 p-6 max-w-2xl w-full">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
            記載予定の内容
          </h2>
          <ul className="space-y-3">
            {[
              'データの収集と利用',
              'クッキーの使用',
              '第三者への情報提供',
              '情報の保護',
              'ユーザーの権利',
              'プライバシーポリシーの変更',
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
            プライバシーポリシーの詳細は準備が整い次第、こちらに掲載いたします。
            <br />
            ご不明な点がございましたら、管理者までお問い合わせください。
          </p>
        </div>
      </div>
    </CommonLayout>
  );
}