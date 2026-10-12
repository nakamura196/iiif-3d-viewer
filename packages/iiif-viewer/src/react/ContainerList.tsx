'use client';

import { labelIn, type ContainerInfo } from '../core';
import { useLocale, useTranslations } from './env';

interface Props {
  containers: ContainerInfo[];
  selected: number;
  onSelect: (index: number) => void;
}

// A strip of buttons to switch between the containers of a manifest.
// Nothing is shown for a single container.
export default function ContainerList({ containers, selected, onSelect }: Props) {
  const t = useTranslations('Viewer');
  const locale = useLocale();
  if (containers.length < 2) return null;
  return (
    <div
      role="tablist"
      aria-label={t('containers')}
      className="flex gap-1 overflow-x-auto p-1.5 bg-[var(--ds-surface)] border-b border-[var(--ds-border)]"
    >
      {containers.map((c, i) => (
        <button
          key={c.id}
          role="tab"
          aria-selected={i === selected}
          onClick={() => onSelect(i)}
          className={`shrink-0 text-sm px-2 py-1 rounded transition-colors ${
            i === selected ? 'bg-blue-600 text-white' : 'text-[var(--ds-fg)] hover:bg-[var(--ds-surface-2)]'
          }`}
        >
          {labelIn(c.label, locale) || `${c.kind} ${i + 1}`}
        </button>
      ))}
    </div>
  );
}
