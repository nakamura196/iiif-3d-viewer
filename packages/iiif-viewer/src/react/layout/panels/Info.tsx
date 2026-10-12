'use client';

import { useState } from 'react';
import type { ContainerInfo, ManifestV4 } from '../../../core';
import { useTranslations } from '../../env';
import { PANELS } from '../../panels/registry';

// 既知のタブ名。機能を足すと増えるので、任意の文字列も受ける。
export type InfoTab = 'metadata' | 'annotations' | 'transcript' | (string & {});

type Props = {
  /** Controlled tab. Without it the component keeps the tab in its own state. */
  tab?: InfoTab;
  onTabChange?: (tab: InfoTab) => void;
  /** The container that is shown. Without it: metadata and annotations (compare page). */
  container?: ContainerInfo;
  manifest?: ManifestV4 | null;
};

const TAB_CLASS = (active: boolean) =>
  `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
    active
      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
      : 'border-transparent text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
  }`;

const Info = ({ tab, onTabChange, container, manifest }: Props) => {
  const t = useTranslations('Info');
  const [inner, setInner] = useState<InfoTab | null>(null);
  const ctx = { container, manifest };
  const available = PANELS.filter((p) => p.available(ctx));
  const ids = available.map((p) => p.id);
  const wanted = tab ?? inner ?? ids[0];
  const active = available.find((p) => p.id === wanted) ?? available[0];

  const handleTabChange = (next: InfoTab) => {
    setInner(next);
    onTabChange?.(next);
  };

  return (
    <div className="h-full flex flex-col">
      {/* タブヘッダー */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        {available.map((p) => (
          <button key={p.id} onClick={() => handleTabChange(p.id)} className={TAB_CLASS(active?.id === p.id)}>
            {t(p.id)}
          </button>
        ))}
      </div>

      {/* タブコンテンツ */}
      <div className="flex-1 overflow-auto bg-white dark:bg-gray-900">
        {active ? <active.Component {...ctx} /> : null}
      </div>
    </div>
  );
};

export default Info;
