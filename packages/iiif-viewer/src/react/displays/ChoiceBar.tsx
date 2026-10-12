'use client';

import type { ReactNode } from 'react';
import { useAtom } from 'jotai';
import { labelIn, type MediaOption, type PaintingContent } from '../../core';
import { modelChoicesAtom } from '../atoms';
import { useLocale, useTranslations } from '../env';

const optionLabel = (o: MediaOption, locale: string) =>
  labelIn(o.label, locale) || decodeURIComponent(o.url.split('/').pop() ?? o.url);

/** Index of the chosen option of a painting (a Choice shows its first one by default). */
export function useChoiceIndex(painting: PaintingContent | undefined): number {
  const [choices] = useAtom(modelChoicesAtom);
  return painting ? Math.min(choices[painting.id] ?? 0, painting.options.length - 1) : 0;
}

// A Choice between two or more candidates of an image / video / audio painting.
// `index` / `onChange` given: the caller keeps the choice (an image Canvas keeps it as layer visibility).
// `children` (e.g. a link to the comparison page) go at the right end of the bar.
export default function ChoiceBar({
  painting,
  index: controlled,
  onChange,
  children,
}: {
  painting: PaintingContent;
  index?: number;
  onChange?: (index: number) => void;
  children?: ReactNode;
}) {
  const t = useTranslations('Viewer');
  const locale = useLocale();
  const [choices, setChoices] = useAtom(modelChoicesAtom);
  const index = controlled ?? Math.min(choices[painting.id] ?? 0, painting.options.length - 1);
  if (painting.options.length < 2) return null;

  return (
    <div className="flex items-center gap-2 p-1.5 bg-[var(--ds-surface)] border-b border-[var(--ds-border)]">
      <label className="text-sm text-[var(--ds-fg)]" htmlFor="iiif-viewer-choice">
        {t('choice')}
      </label>
      <select
        id="iiif-viewer-choice"
        value={index}
        onChange={(e) => {
          const next = Number(e.target.value);
          if (onChange) onChange(next);
          else setChoices((c) => ({ ...c, [painting.id]: next }));
        }}
        className="text-sm rounded border border-[var(--ds-border)] bg-[var(--ds-surface)] text-[var(--ds-fg)] px-1 py-0.5 max-w-full"
      >
        {painting.options.map((o, i) => (
          <option key={o.url} value={i}>
            {optionLabel(o, locale)}
          </option>
        ))}
      </select>
      {children && <div className="ml-auto flex items-center gap-2">{children}</div>}
    </div>
  );
}
