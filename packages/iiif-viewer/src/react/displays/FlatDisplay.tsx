'use client';

import { useTranslations } from '../env';
import ChoiceBar, { useChoiceIndex } from './ChoiceBar';
import ImagePainting from './ImagePainting';
import MediaPainting from './MediaPainting';
import type { Display, DisplayProps } from './types';

const painted = (c: DisplayProps['container']) =>
  c.painting.find((p) => p.options.some((o) => o.kind !== 'Model'));

// Canvas / Timeline with one painting: the chosen option decides the view.
// Image and media each live in their own file (ImagePainting / MediaPainting).
function FlatDisplay({ container }: DisplayProps) {
  const t = useTranslations('Viewer');
  const painting = painted(container);
  const index = useChoiceIndex(painting);
  const option = painting?.options[index];
  if (!painting || !option) return null;

  let view: React.ReactNode;
  if (option.kind === 'Image') view = <ImagePainting container={container} option={option} />;
  else if (option.kind === 'Video' || option.kind === 'Audio')
    view = <MediaPainting container={container} option={{ ...option, kind: option.kind }} />;
  else view = <div className="p-4 text-sm text-[var(--ds-fg)]">{t('unsupportedContent')}</div>;

  return (
    <>
      <ChoiceBar painting={painting} />
      <div className="relative flex-1 min-h-0 min-w-0">{view}</div>
    </>
  );
}

export const flatDisplay: Display = {
  id: 'flat',
  match: (c) => !!painted(c),
  Component: FlatDisplay,
};
