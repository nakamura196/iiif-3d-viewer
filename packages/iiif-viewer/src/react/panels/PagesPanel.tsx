'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { containersOf, labelIn, pageThumbnailUrl } from '../../core';
import { manifestAtom } from '../atoms';
import { navRequestAtom, nextSeq, usePageOrder } from '../displays/structureState';
import { useLocale, useTranslations } from '../env';
import type { Panel, PanelContext } from './types';

// ページ（Canvas / Scene）の一覧。Mirador の「索引」と同じく、右パネルに縦に並べる。
// 選ぶと目次と同じ依頼を出し、ContainerList がページを移す。
function PagesView({ container, manifest }: PanelContext) {
  const t = useTranslations('Structure');
  const locale = useLocale();
  const fromAtom = useAtomValue(manifestAtom);
  const m = manifest ?? fromAtom;
  const setRequest = useSetAtom(navRequestAtom);
  const containers = useMemo(() => containersOf(m), [m]);
  const { order } = usePageOrder(m, containers);
  const [broken, setBroken] = useState<Record<string, boolean>>({});
  const list = useRef<HTMLOListElement>(null);

  const rawItems = useMemo(() => {
    const map = new Map<string, unknown>();
    for (const c of m?.items ?? []) map.set((c as { id: string }).id, c);
    return map;
  }, [m]);

  // 表示中のページが見えるように送る
  useEffect(() => {
    list.current?.querySelector<HTMLElement>('[aria-current="true"]')?.scrollIntoView?.({ block: 'nearest' });
  }, [container?.id]);

  return (
    <ol ref={list} className="p-2 space-y-1" aria-label={t('pages')}>
      {order.map((i) => {
        const c = containers[i];
        if (!c) return null;
        const label = labelIn(c.label, locale) || t('pageLabel', { index: i + 1 });
        const thumb = pageThumbnailUrl(c, rawItems.get(c.id), 160);
        const active = c.id === container?.id;
        return (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => setRequest({ seq: nextSeq(), target: { canvasId: c.id } })}
              aria-current={active ? 'true' : undefined}
              className={`w-full flex items-center gap-3 p-2 rounded text-left text-sm transition-colors ${
                active
                  ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500'
                  : 'text-[var(--ds-fg)] hover:bg-[var(--ds-surface-2)]'
              }`}
            >
              <span className="shrink-0 w-20 h-16 grid place-items-center rounded bg-gray-100 dark:bg-gray-800 overflow-hidden">
                {thumb && !broken[c.id] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumb}
                    alt=""
                    loading="lazy"
                    draggable={false}
                    className="max-w-full max-h-full object-contain"
                    onError={() => setBroken((b) => ({ ...b, [c.id]: true }))}
                  />
                ) : (
                  <span className="text-xs text-gray-500 dark:text-gray-400">{c.kind}</span>
                )}
              </span>
              <span className="min-w-0">
                <span className="block text-xs tabular-nums opacity-70">{i + 1}</span>
                <span className="block break-words">{label}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

export const pagesPanel: Panel = {
  id: 'pages',

  order: 20,
  // 2 ページ以上あるマニフェストだけ（コレクションは別の表示で一覧を出す）
  available: ({ manifest }) =>
    (manifest as { type?: string } | null | undefined)?.type !== 'Collection' && containersOf(manifest).length >= 2,
  Component: (ctx) => <PagesView {...ctx} />,
};
