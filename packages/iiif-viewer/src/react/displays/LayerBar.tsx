'use client';

import { labelIn, type CanvasPainting } from '../../core';
import { useLocale, useTranslations } from '../env';

// 1 枚の Canvas に重ねて描かれた画像（recipe 0036 の合成など）を、レイヤーとして 1 枚ずつ表示・非表示にする。
// 画像が 1 枚だけの Canvas では出さない。
export default function LayerBar({
  paintings,
  hidden,
  onToggle,
}: {
  paintings: CanvasPainting[];
  hidden: Record<string, boolean>;
  onToggle: (id: string) => void;
}) {
  const t = useTranslations('Viewer');
  const locale = useLocale();
  if (paintings.length < 2) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 p-1.5 bg-[var(--ds-surface)] border-b border-[var(--ds-border)]">
      <span className="text-sm text-[var(--ds-fg)]">{t('layers')}</span>
      {paintings.map((p, i) => {
        const name = labelIn(p.label, locale) || t('layerN', { n: i + 1 });
        return (
          <label key={p.id} className="flex items-center gap-1 text-sm text-[var(--ds-fg)] min-w-0" title={name}>
            <input type="checkbox" checked={!hidden[p.id]} onChange={() => onToggle(p.id)} />
            <span className="truncate max-w-[16rem]">{name}</span>
          </label>
        );
      })}
    </div>
  );
}
