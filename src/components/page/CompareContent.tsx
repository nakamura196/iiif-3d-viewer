'use client';

import type { NextPage } from 'next';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useAtom } from 'jotai';
import { useLocale, useTranslations } from 'next-intl';
import {
  annotationsAtom,
  manifestAtom,
  manifestUrlAtom,
  paintedModelsAtom,
} from '@/atoms/infoPanelAtom';
import Header from '@/components/Header';
import ManifestInput from '@/components/Input';
import Info from '@/components/layout/panels/Info';
import SidePanel from '@/components/layout/SidePanel';
import CompareView, { type CompareMode } from '@/components/three/CompareView';
import { fetchManifest } from '@/lib/services/utils';
import { convertToV4 } from '@/lib/services/manifestConverter';
import { parseManifestV4 } from '@/lib/services/manifestParser';
import { labelIn, paintedModelsOf } from '@/lib/services/paintedModels';

const MODES: CompareMode[] = ['side', 'swipe', 'spyglass'];

// Compare two models of the first painted Choice (e.g. LiDAR points and textured
// buildings of the same area). Other painted models are drawn on both sides.
// The URL keeps what is shown: ?manifest=...&a=0&b=1&mode=swipe
const CompareContent: NextPage = () => {
  const t = useTranslations('Compare');
  const locale = useLocale();
  const [manifestUrl, setManifestUrl] = useAtom(manifestUrlAtom);
  const [, setManifest] = useAtom(manifestAtom);
  const [, setAnnotations] = useAtom(annotationsAtom);
  const [paintedModels, setPaintedModels] = useAtom(paintedModelsAtom);
  const [mode, setMode] = useState<CompareMode>('side');
  const [pick, setPick] = useState<[number, number]>([0, 1]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const m = params.get('manifest');
    if (m) setManifestUrl(m);
    const mo = params.get('mode') as CompareMode | null;
    if (mo && MODES.includes(mo)) setMode(mo);
    const a = Number(params.get('a') ?? 0);
    const b = Number(params.get('b') ?? 1);
    if (Number.isInteger(a) && Number.isInteger(b)) setPick([a, b]);
  }, [setManifestUrl]);

  useEffect(() => {
    if (!manifestUrl) return;
    fetchManifest(manifestUrl).then((raw) => {
      if (!raw) return;
      const manifest = convertToV4(raw);
      setPaintedModels(paintedModelsOf(manifest.items?.[0]));
      setManifest(manifest);
      setAnnotations(parseManifestV4(manifest).annotations);
    });
  }, [manifestUrl, setManifest, setAnnotations, setPaintedModels]);

  // keep the choice in the URL so that a comparison can be shared
  useEffect(() => {
    if (!manifestUrl) return;
    const params = new URLSearchParams(window.location.search);
    params.set('a', String(pick[0]));
    params.set('b', String(pick[1]));
    params.set('mode', mode);
    window.history.replaceState(null, '', `?${params.toString()}`);
  }, [manifestUrl, pick, mode]);

  const main = paintedModels[0];
  const options = useMemo(() => main?.options ?? [], [main]);
  const extraModels = useMemo(
    () => paintedModels.slice(1).map((m) => ({ url: m.options[0].url, position: m.position })),
    [paintedModels],
  );
  const at = (i: number) => options[Math.min(Math.max(i, 0), options.length - 1)];
  const nameOf = (i: number) => {
    const o = at(i);
    return o ? labelIn(o.label, locale) || o.url.split('/').pop() || '' : '';
  };

  const select = (side: 0 | 1, value: number) =>
    setPick((p) => (side === 0 ? [value, p[1]] : [p[0], value]));

  const selectClass =
    'text-sm rounded border border-[var(--ds-border)] bg-[var(--ds-surface)] text-[var(--ds-fg)] px-2 py-1 max-w-[12rem]';

  return (
    <div className="flex flex-col h-screen">
      <Header />
      <main className="flex-1 flex overflow-hidden">
        {manifestUrl ? (
          <div className="flex flex-col sm:flex-row w-full">
            <div className="flex-1 min-h-0 min-w-0 flex flex-col">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2 border-b border-[var(--ds-border)] bg-[var(--ds-surface)]">
                <div role="radiogroup" aria-label={t('mode')} className="flex rounded overflow-hidden border border-[var(--ds-border)]">
                  {MODES.map((m) => (
                    <button
                      key={m}
                      role="radio"
                      aria-checked={mode === m}
                      onClick={() => setMode(m)}
                      className={`text-sm px-3 py-1 transition-colors ${
                        mode === m ? 'bg-blue-600 text-white' : 'text-[var(--ds-fg)] hover:bg-[var(--ds-surface-2)]'
                      }`}
                    >
                      {t(`modes.${m}`)}
                    </button>
                  ))}
                </div>
                {([0, 1] as const).map((side) => (
                  <label key={side} className="flex items-center gap-1.5 text-sm text-[var(--ds-fg)]">
                    {side === 0 ? 'A' : 'B'}
                    <select value={pick[side]} onChange={(e) => select(side, Number(e.target.value))} className={selectClass}>
                      {options.map((o, i) => (
                        <option key={o.url} value={i}>
                          {labelIn(o.label, locale) || o.url.split('/').pop()}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
                {options.length < 2 && paintedModels.length > 0 && (
                  <span className="text-xs text-[var(--ds-fg)]">{t('noChoice')}</span>
                )}
              </div>
              <div className="flex-1 min-h-0">
                <CompareView
                  mode={mode}
                  urls={[at(pick[0])?.url ?? null, at(pick[1])?.url ?? null]}
                  labels={[nameOf(pick[0]), nameOf(pick[1])]}
                  extraModels={extraModels}
                />
              </div>
            </div>
            <SidePanel className="bg-[var(--ds-surface)] shadow-lg overflow-y-auto border-t sm:border-t-0 sm:border-l border-[var(--ds-border)]">
              <Suspense fallback={null}>
                <Info />
              </Suspense>
            </SidePanel>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ManifestInput onSubmit={(url: string) => setManifestUrl(url)} />
          </div>
        )}
      </main>
    </div>
  );
};

export default CompareContent;
