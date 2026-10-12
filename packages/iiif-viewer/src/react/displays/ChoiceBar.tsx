'use client';

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
export default function ChoiceBar({ painting }: { painting: PaintingContent }) {
  const t = useTranslations('Viewer');
  const locale = useLocale();
  const [choices, setChoices] = useAtom(modelChoicesAtom);
  const index = Math.min(choices[painting.id] ?? 0, painting.options.length - 1);
  if (painting.options.length < 2) return null;

  return (
    <div className="flex items-center gap-2 p-1.5 bg-[var(--ds-surface)] border-b border-[var(--ds-border)]">
      <label className="text-sm text-[var(--ds-fg)]" htmlFor="iiif-viewer-choice">
        {t('choice')}
      </label>
      <select
        id="iiif-viewer-choice"
        value={index}
        onChange={(e) => setChoices((c) => ({ ...c, [painting.id]: Number(e.target.value) }))}
        className="text-sm rounded border border-[var(--ds-border)] bg-[var(--ds-surface)] text-[var(--ds-fg)] px-1 py-0.5 max-w-full"
      >
        {painting.options.map((o, i) => (
          <option key={o.url} value={i}>
            {optionLabel(o, locale)}
          </option>
        ))}
      </select>
    </div>
  );
}
