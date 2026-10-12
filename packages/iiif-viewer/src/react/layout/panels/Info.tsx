'use client';

import { useState, type ReactNode } from 'react';
import AnnotationList from '../../annotation/AnnotationList';
import Metadata from '../../metadata/Metadata';
import { useTranslations } from '../../env';

export type InfoTab = 'metadata' | 'annotations' | 'transcript';

type Props = {
  /** Controlled tab. Without it the component keeps the tab in its own state. */
  tab?: InfoTab;
  onTabChange?: (tab: InfoTab) => void;
  /** Show the annotation tab (3D scenes). Default true. */
  showAnnotations?: boolean;
  /** When given, a transcript tab with this content is added (placed after metadata). */
  transcript?: ReactNode;
};

const TAB_CLASS = (active: boolean) =>
  `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
    active
      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
      : 'border-transparent text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
  }`;

const Info = ({ tab, onTabChange, showAnnotations = true, transcript }: Props) => {
  const t = useTranslations('Info');
  const [inner, setInner] = useState<InfoTab | null>(null);
  const hasTranscript = transcript !== undefined && transcript !== null;
  const available: InfoTab[] = [
    'metadata',
    ...(hasTranscript ? (['transcript'] as const) : []),
    ...(showAnnotations ? (['annotations'] as const) : []),
  ];
  const wanted = tab ?? inner ?? available[0];
  const activeTab: InfoTab = available.includes(wanted) ? wanted : 'metadata';

  const handleTabChange = (next: InfoTab) => {
    setInner(next);
    onTabChange?.(next);
  };

  return (
    <div className="h-full flex flex-col">
      {/* タブヘッダー */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        {available.map((name) => (
          <button key={name} onClick={() => handleTabChange(name)} className={TAB_CLASS(activeTab === name)}>
            {t(name)}
          </button>
        ))}
      </div>

      {/* タブコンテンツ */}
      <div className="flex-1 overflow-auto bg-white dark:bg-gray-900">
        {activeTab === 'transcript' ? transcript : activeTab === 'metadata' ? <Metadata /> : <AnnotationList />}
      </div>
    </div>
  );
};

export default Info;
