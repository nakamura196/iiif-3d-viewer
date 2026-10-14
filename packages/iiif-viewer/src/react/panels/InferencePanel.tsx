'use client';

import { useEffect, useRef, useState } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { imageLayerCount, toAnnotationPage, toPlainText, type ContainerInfo, type ManifestV4 } from '../../core';
import { useLocale, useTranslations, type Translator } from '../env';
import { runModel } from '../inference/client';
import { downloadModel, modelStatus, removeModel, totalBytes, type ModelStatus } from '../inference/modelStore';
import { MODELS } from '../inference/models/registry';
import type { InferenceModel } from '../inference/models/types';
import { SourceImageError, baseImageLayerOf, loadSourceImage } from '../inference/sourceImage';
import { inferenceResultsAtom, resultKey, type InferenceResult } from '../inference/state';
import { localAnnotationPagesAtom, selectedCanvasAnnotationAtom } from '../overlays/canvasAnnotationState';
import type { Panel, PanelContext } from './types';

// ブラウザ内の推論（OCR など）。モデルごとに「ダウンロード → この画像で実行 → 画像に重ねる・結果を保存」。
// モデルはこの端末のブラウザに保存し、画像はどこにも送らない。モデルの一覧は inference/models/registry.ts。

const BUTTON =
  'px-2.5 py-1 rounded border border-gray-300 dark:border-gray-600 text-xs hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:hover:bg-transparent';
const PRIMARY =
  'px-2.5 py-1 rounded text-xs text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600';

const mb = (bytes: number) => `${Math.round(bytes / 1e6)} MB`;

const saveFile = (name: string, text: string, type: string) => {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const fileStem = (container: ContainerInfo, modelId: string) => {
  const tail = container.id.split('/').filter(Boolean).pop() ?? 'canvas';
  return `${tail.replace(/[^\w.-]+/g, '_')}-${modelId}`;
};

const newId = () => `urn:uuid:${crypto.randomUUID()}`;

function Progress({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full rounded bg-gray-200 dark:bg-gray-700 overflow-hidden" aria-hidden="true">
      <div className="h-full bg-blue-600 transition-[width]" style={{ width: `${Math.round(value * 100)}%` }} />
    </div>
  );
}

function ResultView({ result, container, t }: { result: InferenceResult; container: ContainerInfo; t: Translator }) {
  const [local, setLocal] = useAtom(localAnnotationPagesAtom);
  const [selected, setSelected] = useAtom(selectedCanvasAnnotationAtom);
  const setResults = useSetAtom(inferenceResultsAtom);
  const source = `inference:${result.modelId}`;
  const shown = local.some((l) => l.source === source && l.canvasId === result.canvasId);
  const items = (result.page.items as { id: string }[]) ?? [];
  const stem = fileStem(container, result.modelId);

  const setShown = (on: boolean) =>
    setLocal((ls) => [
      ...ls.filter((l) => !(l.source === source && l.canvasId === result.canvasId)),
      ...(on ? [{ source, canvasId: result.canvasId, page: result.page }] : []),
    ]);
  const discard = () => {
    setShown(false);
    setResults((rs) => {
      const next = { ...rs };
      delete next[resultKey(result.canvasId, result.modelId)];
      return next;
    });
  };

  return (
    <div className="mt-2 space-y-2">
      <p className="text-xs text-gray-600 dark:text-gray-300">
        {t('resultSummary', { count: items.length, seconds: (result.ms / 1000).toFixed(1), backend: result.backends.join(' + ') })}
      </p>
      <div className="flex flex-wrap gap-2">
        <label className="inline-flex items-center gap-1 text-xs">
          <input type="checkbox" checked={shown} onChange={(e) => setShown(e.target.checked)} />
          {t('showOnImage')}
        </label>
        <button
          type="button"
          className={BUTTON}
          onClick={() => saveFile(`${stem}.json`, JSON.stringify(result.page, null, 2), 'application/ld+json')}
        >
          {t('saveJson')}
        </button>
        {result.output.kind === 'lines' ? (
          <button type="button" className={BUTTON} onClick={() => saveFile(`${stem}.txt`, `${toPlainText(result.output)}\n`, 'text/plain')}>
            {t('saveText')}
          </button>
        ) : null}
        <button type="button" className={BUTTON} onClick={discard}>
          {t('discard')}
        </button>
      </div>
      {result.output.kind === 'lines' && items.length > 0 ? (
        <ol className="max-h-72 overflow-auto rounded border border-gray-200 dark:border-gray-700 text-sm divide-y divide-gray-100 dark:divide-gray-800">
          {result.output.items
            .filter((d) => d.text)
            .map((d, i) => {
              const id = items[i]?.id;
              const on = !!id && selected === id;
              return (
                <li key={id ?? i}>
                  <button
                    type="button"
                    disabled={!shown}
                    onClick={() => setSelected(on ? null : id)}
                    className={`w-full text-left px-2 py-1 ${on ? 'bg-blue-50 dark:bg-blue-950' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                  >
                    <span className="mr-2 text-xs text-gray-400 tabular-nums">{i + 1}</span>
                    {d.text}
                  </button>
                </li>
              );
            })}
        </ol>
      ) : null}
    </div>
  );
}

function ModelCard({ model, container, manifest }: { model: InferenceModel; container: ContainerInfo; manifest?: ManifestV4 | null }) {
  const t = useTranslations('Inference');
  const locale = useLocale() === 'ja' ? 'ja' : 'en';
  const [status, setStatus] = useState<ModelStatus | null>(null);
  const [download, setDownload] = useState<number | null>(null);
  const [running, setRunning] = useState<{ stage: string; done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const [results, setResults] = useAtom(inferenceResultsAtom);
  const setLocal = useSetAtom(localAnnotationPagesAtom);
  const result = results[resultKey(container.id, model.id)];

  useEffect(() => {
    let live = true;
    modelStatus(model).then((s) => live && setStatus(s));
    return () => {
      live = false;
    };
  }, [model]);

  const startDownload = async () => {
    setError(null);
    const ac = new AbortController();
    abort.current = ac;
    setDownload(0);
    try {
      await downloadModel(model, (loaded, total) => setDownload(loaded / total), ac.signal);
      setStatus('ready');
    } catch (e) {
      if (!ac.signal.aborted) setError(t('downloadFailed', { message: String((e as Error).message ?? e) }));
      setStatus(await modelStatus(model));
    } finally {
      setDownload(null);
      abort.current = null;
    }
  };

  const remove = async () => {
    await removeModel(model);
    setStatus('none');
  };

  const run = async () => {
    setError(null);
    const layer = baseImageLayerOf(manifest, container);
    if (!layer) {
      setError(t('noImage'));
      return;
    }
    setRunning({ stage: 'image', done: 0, total: 1 });
    try {
      const src = await loadSourceImage(layer, container, model.imageLongSide);
      const r = await runModel(model.id, src.bitmap, (stage, done, total) => setRunning({ stage, done, total }));
      const page = toAnnotationPage(r.output, {
        canvasId: container.id,
        map: src.map,
        newId,
        generator: { id: model.homepage, name: model.name[locale] },
      });
      const res: InferenceResult = {
        canvasId: container.id,
        modelId: model.id,
        output: r.output,
        page,
        backends: r.backends,
        ms: r.ms,
        created: new Date().toISOString(),
      };
      setResults((rs) => ({ ...rs, [resultKey(container.id, model.id)]: res }));
      const source = `inference:${model.id}`;
      setLocal((ls) => [...ls.filter((l) => !(l.source === source && l.canvasId === container.id)), { source, canvasId: container.id, page }]);
    } catch (e) {
      setError(e instanceof SourceImageError ? t(`image_${e.reason}`) : t('runFailed', { message: String((e as Error).message ?? e) }));
    } finally {
      setRunning(null);
    }
  };

  const busy = download !== null || running !== null;

  return (
    <li className="rounded border border-gray-200 dark:border-gray-700 p-3">
      <div className="flex items-baseline gap-2">
        <h3 className="flex-1 min-w-0 font-medium">{model.name[locale]}</h3>
        <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400 tabular-nums">{mb(totalBytes(model))}</span>
      </div>
      <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">{model.description[locale]}</p>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        <a href={model.homepage} target="_blank" rel="noopener noreferrer" className="underline">
          {model.credit[locale]}
        </a>{' '}
        · {model.license}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {status !== 'ready' ? (
          download === null ? (
            <button type="button" className={PRIMARY} disabled={status === null} onClick={startDownload}>
              {t('download', { size: mb(totalBytes(model)) })}
            </button>
          ) : (
            <button type="button" className={BUTTON} onClick={() => abort.current?.abort()}>
              {t('cancel')}
            </button>
          )
        ) : (
          <>
            <button type="button" className={PRIMARY} disabled={busy} onClick={run}>
              {result ? t('runAgain') : t('run')}
            </button>
            <button type="button" className={BUTTON} disabled={busy} onClick={remove}>
              {t('remove')}
            </button>
          </>
        )}
      </div>

      {download !== null ? (
        <div className="mt-2 space-y-1" role="status">
          <Progress value={download} />
          <p className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
            {t('downloading', { done: mb(download * totalBytes(model)), total: mb(totalBytes(model)) })}
          </p>
        </div>
      ) : null}
      {running ? (
        <div className="mt-2 space-y-1" role="status">
          <Progress value={running.total ? running.done / running.total : 0} />
          <p className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
            {t(`stage_${running.stage}`, { done: running.done, total: running.total })}
          </p>
        </div>
      ) : null}
      {error ? (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
      {result && !running ? <ResultView result={result} container={container} t={t} /> : null}
    </li>
  );
}

function InferenceTab({ container, manifest }: PanelContext) {
  const t = useTranslations('Inference');
  if (!container) return null;
  return (
    <div className="p-3 text-sm text-[var(--ds-fg)] space-y-3">
      <p className="text-xs text-gray-500 dark:text-gray-400">{t('hint')}</p>
      <ul className="space-y-3">
        {MODELS.map((m) => (
          <ModelCard key={m.id} model={m} container={container} manifest={manifest} />
        ))}
      </ul>
    </div>
  );
}

// 画像の Canvas でだけ出す（3D・音声・動画では出さない）
export const inferencePanel: Panel = {
  id: 'inference',
  available: ({ container }) => container?.kind === 'Canvas' && imageLayerCount(container.painting) > 0,
  Component: InferenceTab,
};
