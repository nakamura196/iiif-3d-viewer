'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import AnnotationList from '@/components/annotation/AnnotationList';
import Metadata from '@/components/metadata/Metadata';
import { useTranslations } from 'next-intl';

type TabType = 'metadata' | 'annotations';

const Info = () => {
  const t = useTranslations('Info');
  const searchParams = useSearchParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>(
    (searchParams?.get('tab') as TabType) || 'metadata'
  );

  const handleTabChange = (tab: TabType) => {
    // 現在のURLパラメータを取得
    const params = new URLSearchParams(searchParams?.toString() || '');
    // タブパラメータを更新
    params.set('tab', tab);
    // URLを更新（履歴に追加）
    router.push(`?${params.toString()}`);
    setActiveTab(tab);
  };

  // URLパラメータが変更されたときにタブを更新
  useEffect(() => {
    const tabParam = searchParams?.get('tab') as TabType;
    if (tabParam && (tabParam === 'metadata' || tabParam === 'annotations')) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  return (
    <div className="h-full flex flex-col">
      {/* タブヘッダー */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <button
          onClick={() => handleTabChange('metadata')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors
            ${
              activeTab === 'metadata'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
        >
          {t('metadata')}
        </button>
        <button
          onClick={() => handleTabChange('annotations')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors
            ${
              activeTab === 'annotations'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
        >
          {t('annotations')}
        </button>
      </div>

      {/* タブコンテンツ */}
      <div className="flex-1 overflow-auto bg-white dark:bg-gray-900">
        {activeTab === 'metadata' ? <Metadata /> : <AnnotationList />}
      </div>
    </div>
  );
};

export default Info;
