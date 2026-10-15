'use client';

import type { NextPage } from 'next';
import { useEffect, useMemo, useState } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { useLocale, useTranslations } from 'next-intl';
import {
  ImageCompareView,
  Info,
  SidePanel,
  manifestAtom,
  manifestUrlAtom,
  paintedModelsAtom,
  useCanvasImages,
  useManifest,
  type CompareMode,
  type SwipeDirection,
} from '@nakamura196/iiif-viewer';
import Header from '@/components/Header';
import ManifestInput from '@/components/Input';
import CompareView, { type CompareMode3D } from '@/components/three/CompareView';
import { containersOf, imageChoiceOf, labelIn } from '@nakamura196/iiif-viewer/core';
import { manifestFromParams } from '@nakamura196/iiif-viewer/core';

const MODES: CompareMode[] = ['side', 'swipe', 'spyglass', 'overlay'];
// overlay fades one picture into the other: images only
const MODES_3D: CompareMode3D[] = ['side', 'swipe', 'spyglass'];
const ZOOMS = [1, 2, 3];

// A row of buttons of which one is on (the mode, the spyglass zoom).
function Segmented<T extends string | number>({
  label,
  items,
  value,
  onChange,
  text,
}: {
  label: string;
  items: T[];
  value: T;
  onChange: (v: T) => void;
  text: (v: T) => string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded overflow-hidden border border-[var(--ds-border)]">
      {items.map((v) => (
        <button
          key={v}
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={`text-sm px-3 py-1 transition-colors ${
            value === v ? 'bg-blue-600 text-white' : 'text-[var(--ds-fg)] hover:bg-[var(--ds-surface-2)]'
          }`}
        >
          {text(v)}
        </button>
      ))}
    </div>
  );
}

// Compare two candidates of a Choice: two models of the first painted Choice of a 3D Scene
// (e.g. LiDAR points and textured buildings of the same area; other painted models are drawn
// on both sides), or two images of a Canvas (e.g. a letter in ordinary and transmitted light).
// The URL keeps what is shown: ?iiif-content=...&canvas=0&a=0&b=1&mode=swipe(&zoom=2)(&opacity=50)(&dir=v)
const CompareContent: NextPage = () => {
  const t = useTranslations('Compare');
  const locale = useLocale();
  const [manifestUrl, setManifestUrl] = useAtom(manifestUrlAtom);
  const manifest = useAtomValue(manifestAtom);
  const paintedModels = useAtomValue(paintedModelsAtom);
  const [mode, setMode] = useState<CompareMode>('side');
  const [pick, setPick] = useState<[number, number]>([0, 1]);
  const [canvas, setCanvas] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [opacity, setOpacity] = useState(50); // %
  const [direction, setDirection] = useState<SwipeDirection>('horizontal');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const m = manifestFromParams(params);
    if (m) setManifestUrl(m);
    const mo = params.get('mode') as CompareMode | null;
    if (mo && MODES.includes(mo)) setMode(mo);
    const a = Number(params.get('a') ?? 0);
    const b = Number(params.get('b') ?? 1);
    if (Number.isInteger(a) && Number.isInteger(b)) setPick([a, b]);
    const c = Number(params.get('canvas') ?? 0);
    if (Number.isInteger(c) && c >= 0) setCanvas(c);
    const z = Number(params.get('zoom') ?? 1);
    if (ZOOMS.includes(z)) setZoom(z);
    const o = Number(params.get('opacity') ?? 50);
    if (o >= 0 && o <= 100) setOpacity(o);
    if (params.get('dir') === 'v') setDirection('vertical');
  }, [setManifestUrl]);

  useManifest(manifestUrl);

  // 3D when the first Scene paints a model; otherwise the images of the chosen Canvas
  const is3D = paintedModels.length > 0;
  const containers = useMemo(() => containersOf(manifest), [manifest]);
  const canvasIndex = Math.min(canvas, Math.max(containers.length - 1, 0));
  const images = useCanvasImages(is3D ? null : manifestUrl, containers[canvasIndex]?.id);
  const imageChoice = is3D ? undefined : imageChoiceOf(images);
  const modes: CompareMode[] = is3D ? MODES_3D : MODES;
  const shownMode = modes.includes(mode) ? mode : 'side';

  // keep the choice in the URL so that a comparison can be shared
  useEffect(() => {
    if (!manifestUrl) return;
    const params = new URLSearchParams(window.location.search);
    params.set('a', String(pick[0]));
    params.set('b', String(pick[1]));
    params.set('mode', mode);
    const keep = (key: string, value: string | null) => (value === null ? params.delete(key) : params.set(key, value));
    keep('canvas', is3D || canvasIndex === 0 ? null : String(canvasIndex));
    keep('zoom', !is3D && mode === 'spyglass' && zoom !== 1 ? String(zoom) : null);
    keep('opacity', !is3D && mode === 'overlay' ? String(opacity) : null);
    keep('dir', mode === 'swipe' && direction === 'vertical' ? 'v' : null);
    window.history.replaceState(null, '', `?${params.toString()}`);
  }, [manifestUrl, pick, mode, is3D, canvasIndex, zoom, opacity, direction]);

  const main = paintedModels[0];
  const options = useMemo(
    () => (is3D ? main?.options ?? [] : imageChoice?.options ?? []),
    [is3D, main, imageChoice],
  );
  const extraModels = useMemo(
    () => paintedModels.slice(1).map((m) => ({ url: m.options[0].url, position: m.position })),
    [paintedModels],
  );
  const clamp = (i: number) => Math.min(Math.max(i, 0), Math.max(options.length - 1, 0));
  const at = (i: number) => options[clamp(i)];
  const nameOf = (i: number) => {
    const o = at(i);
    return o ? labelIn(o.label, locale) || o.url.split('/').pop() || '' : '';
  };

  const select = (side: 0 | 1, value: number) =>
    setPick((p) => (side === 0 ? [value, p[1]] : [p[0], value]));

  const selectClass =
    'text-sm rounded border border-[var(--ds-border)] bg-[var(--ds-surface)] text-[var(--ds-fg)] px-2 py-1 max-w-[12rem]';
  const labelClass = 'flex items-center gap-1.5 text-sm text-[var(--ds-fg)]';

  let noChoice: string | null = null;
  if (is3D && options.length < 2) noChoice = t('noChoice');
  else if (!is3D && images && !imageChoice) noChoice = t('noImageChoice');

  return (
    <div className="flex flex-col h-dvh">
      <Header compact />
      <main className="flex-1 flex overflow-hidden">
        {manifestUrl ? (
          <div className="flex flex-col sm:flex-row w-full">
            <div className="flex-1 min-h-0 min-w-0 flex flex-col">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2 border-b border-[var(--ds-border)] bg-[var(--ds-surface)]">
                <Segmented label={t('mode')} items={modes} value={shownMode} onChange={setMode} text={(m) => t(`modes.${m}`)} />
                {shownMode === 'swipe' && (
                  <Segmented
                    label={t('swipeDirection')}
                    items={['horizontal', 'vertical'] as SwipeDirection[]}
                    value={direction}
                    onChange={setDirection}
                    text={(d) => t(`directions.${d === 'vertical' ? 'v' : 'h'}`)}
                  />
                )}
                {!is3D && containers.length > 1 && (
                  <label className={labelClass}>
                    {t('canvas')}
                    <select value={canvasIndex} onChange={(e) => setCanvas(Number(e.target.value))} className={selectClass}>
                      {containers.map((c, i) => (
                        <option key={c.id} value={i}>
                          {labelIn(c.label, locale) || String(i + 1)}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {([0, 1] as const).map((side) => (
                  <label key={side} className={labelClass}>
                    {side === 0 ? 'A' : 'B'}
                    <select value={clamp(pick[side])} onChange={(e) => select(side, Number(e.target.value))} className={selectClass}>
                      {options.map((o, i) => (
                        <option key={o.url} value={i}>
                          {labelIn(o.label, locale) || o.url.split('/').pop()}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
                {!is3D && shownMode === 'spyglass' && (
                  <span className={labelClass}>
                    {t('zoom')}
                    <Segmented label={t('zoom')} items={ZOOMS} value={zoom} onChange={setZoom} text={(z) => `×${z}`} />
                  </span>
                )}
                {!is3D && shownMode === 'overlay' && (
                  <label className={labelClass}>
                    {t('opacity')}
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={opacity}
                      onChange={(e) => setOpacity(Number(e.target.value))}
                      className="w-32"
                    />
                    <span className="w-9 text-right tabular-nums">{opacity}%</span>
                  </label>
                )}
                {noChoice && <span className="text-xs text-[var(--ds-fg)]">{noChoice}</span>}
              </div>
              <div className="flex-1 min-h-0">
                {is3D ? (
                  <CompareView
                    mode={shownMode === 'overlay' ? 'side' : shownMode}
                    urls={[at(pick[0])?.url ?? null, at(pick[1])?.url ?? null]}
                    labels={[nameOf(pick[0]), nameOf(pick[1])]}
                    extraModels={extraModels}
                    swipeDirection={direction}
                  />
                ) : (
                  images &&
                  imageChoice && (
                    <ImageCompareView
                      images={images}
                      choice={imageChoice}
                      pick={[clamp(pick[0]), clamp(pick[1])]}
                      mode={shownMode}
                      labels={[nameOf(pick[0]), nameOf(pick[1])]}
                      zoom={zoom}
                      opacity={opacity / 100}
                      swipeHandleLabel={t('swipeHandle')}
                      spyglassHint={t('spyglassHint')}
                      swipeDirection={direction}
                    />
                  )
                )}
              </div>
            </div>
            <SidePanel className="bg-[var(--ds-surface)] shadow-lg overflow-y-auto border-t sm:border-t-0 sm:border-l border-[var(--ds-border)]">
              <Info />
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
