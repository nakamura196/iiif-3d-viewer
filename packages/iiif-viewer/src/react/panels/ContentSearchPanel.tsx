'use client';

import { atom, useAtom, useSetAtom } from 'jotai';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  TEXT_GRANULARITIES,
  containersOf,
  contentSearchAnnotationPage,
  fetchContentSearchTerms,
  findContentSearchService,
  groupMatchesByCanvas,
  labelIn,
  runContentSearch,
  type ContentSearchMatch,
  type ContentSearchResult,
  type ContentSearchService,
  type ContentSearchTerm,
} from '../../core';
import { navRequestAtom, nextSeq } from '../displays/structureState';
import { useLocale, useTranslations } from '../env';
import { localAnnotationPagesAtom, selectedCanvasAnnotationAtom } from '../overlays/canvasAnnotationState';
import type { Panel, PanelContext } from './types';

// 資料の中の文字を探す（IIIF Content Search API 1.0 / 2.0）。窓口はマニフェストの service に書かれたもの。
// 当たりは一覧に出し、画像の上にも印を出す（推論の結果と同じ「手元の注釈」の仕組みを使う）。
// 押すとそのページに移り、当たった所へ寄る。単位（行・語）が書いてあれば、それで絞り込める。

const SOURCE = 'content-search';
const MAX_PAGES = 20;
const MAX_MATCHES = 2000;
/** 一覧に一度に出す数（Wellcome は 1 回で 1,753 件を返すことがある） */
const LIST_STEP = 200;

const BUTTON =
  'px-2.5 py-1 rounded border border-gray-300 dark:border-gray-600 text-xs hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40';
const PRIMARY = 'px-3 py-1 rounded text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40';

interface SearchState {
  /** 何回目の検索か。古い検索の応答が後から届いても、新しい結果を上書きしない */
  run: number;
  /** どのマニフェストの検索か（別の資料を開いたら捨てる） */
  manifestId: string;
  q: string;
  status: 'running' | 'done' | 'error';
  result?: ContentSearchResult;
}

/** 検索の結果。タブを切り替えても残す。Viewer に 1 つ（jotai store ごと）。 */
const contentSearchAtom = atom<SearchState | null>(null);
let runCounter = 0;
/** 絞り込む単位（null はすべて） */
const granularityAtom = atom<string | null>(null);
const showMarksAtom = atom<boolean>(true);

const fetchJson = async (url: string): Promise<unknown> => {
  const r = await fetch(url, { headers: { Accept: 'application/ld+json, application/json' }, credentials: 'omit' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
};

const urlQuery = (): string => {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get('q')?.trim() ?? '';
};

const granularityRank = (g: string) => {
  const i = (TEXT_GRANULARITIES as readonly string[]).indexOf(g);
  return i < 0 ? TEXT_GRANULARITIES.length : i;
};

function useAutocomplete(service: ContentSearchService | undefined, text: string): ContentSearchTerm[] {
  const [terms, setTerms] = useState<{ q: string; terms: ContentSearchTerm[] }>({ q: '', terms: [] });
  const ac = service?.autocomplete;
  const q = text.trim();
  useEffect(() => {
    if (!ac || q.length < 2) return;
    let live = true;
    const timer = window.setTimeout(() => {
      fetchContentSearchTerms(ac, q, fetchJson).then(
        (ts) => live && setTerms({ q, terms: ts.slice(0, 20) }),
        () => {}, // 候補が出ないだけにする
      );
    }, 250);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [ac, q]);
  return ac && q.length >= 2 && terms.q === q ? terms.terms : [];
}

function MatchText({ match }: { match: ContentSearchMatch }) {
  return (
    <span className="break-words">
      {match.before ? <span className="text-gray-500 dark:text-gray-400">…{match.before}</span> : null}
      <mark className="bg-yellow-200 dark:bg-yellow-700 dark:text-white rounded-sm px-0.5">{match.match || '—'}</mark>
      {match.after ? <span className="text-gray-500 dark:text-gray-400">{match.after}…</span> : null}
    </span>
  );
}

export function ContentSearchPanelBody({ container, manifest }: PanelContext) {
  const t = useTranslations('ContentSearch');
  const locale = useLocale();
  const service = useMemo(() => findContentSearchService(manifest), [manifest]);
  const manifestId = manifest?.id ?? '';
  const [state, setState] = useAtom(contentSearchAtom);
  const [granularity, setGranularity] = useAtom(granularityAtom);
  const [showMarks, setShowMarks] = useAtom(showMarksAtom);
  const setLocal = useSetAtom(localAnnotationPagesAtom);
  const [selected, setSelected] = useAtom(selectedCanvasAnnotationAtom);
  const setRequest = useSetAtom(navRequestAtom);
  const current = state && state.manifestId === manifestId ? state : null;
  const [text, setText] = useState(() => current?.q ?? urlQuery());
  const [limit, setLimit] = useState(LIST_STEP);
  const [copied, setCopied] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const terms = useAutocomplete(service, text);

  const search = (q: string) => {
    const word = q.trim();
    abort.current?.abort();
    if (!service || !word) return;
    const ctl = new AbortController();
    abort.current = ctl;
    const run = ++runCounter;
    // この検索がまだ最新のときだけ書く（タブを開き直すと abort.current は別物になるため、番号でも見る）
    const put = (next: Omit<SearchState, 'run' | 'manifestId' | 'q'>) =>
      setState((prev) => (ctl.signal.aborted || prev?.run !== run ? prev : { run, manifestId, q: word, ...next }));
    setLimit(LIST_STEP);
    setGranularity(null);
    setSelected(null);
    setState({ run, manifestId, q: word, status: 'running' });
    runContentSearch(service, word, fetchJson, {
      maxPages: MAX_PAGES,
      maxMatches: MAX_MATCHES,
      signal: ctl.signal,
      // 1 ページ目が来た時点で一覧を出す（続きは後から足される）
      onPage: (soFar) => put({ status: 'running', result: { ...soFar, truncated: false } }),
    }).then(
      (result) => put({ status: 'done', result }),
      () => put({ status: 'error' }),
    );
  };

  // ?q= があれば、開いたときに 1 回だけ探す
  const fromUrl = useRef(false);
  useEffect(() => {
    if (fromUrl.current || !service) return;
    fromUrl.current = true;
    const q = urlQuery();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- URL はブラウザでしか読めない
    if (q && current?.q !== q) search(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service]);

  // タブを閉じても検索は止めない（結果は Viewer の状態に残り、印も出し続ける）。
  // 止めるのは、次の検索を始めたときと「消す」を押したときだけ。

  const matches = useMemo(() => current?.result?.matches ?? [], [current]);
  const granularities = useMemo(
    () => [...new Set(matches.map((m) => m.granularity).filter((g): g is string => !!g))].sort((a, b) => granularityRank(a) - granularityRank(b)),
    [matches],
  );
  const shown = useMemo(
    () => (granularity ? matches.filter((m) => m.granularity === granularity) : matches),
    [matches, granularity],
  );

  // 画像の上の印。当たりのある Canvas ごとに 1 ページ（絞り込みに合わせる）
  useEffect(() => {
    setLocal((ls) => {
      const rest = ls.filter((l) => l.source !== SOURCE);
      if (!showMarks || shown.length === 0) return rest;
      const pages = [...groupMatchesByCanvas(shown)].map(([canvasId, ms]) => ({
        source: SOURCE,
        canvasId,
        page: contentSearchAnnotationPage(canvasId, ms),
      }));
      return [...rest, ...pages];
    });
  }, [shown, showMarks, setLocal]);

  const canvasLabels = useMemo(() => {
    const m = new Map<string, string>();
    // 何枚目かを必ず出す。ラベルが番号と同じか「-」（Wellcome の番号の無いページ）のときは番号だけ
    containersOf(manifest).forEach((c, i) => {
      const n = `${i + 1}`;
      const label = labelIn(c.label, locale).trim();
      m.set(c.id, label && label !== '-' && label !== n ? `${n} · ${label}` : n);
    });
    return m;
  }, [manifest, locale]);
  const canvasOrder = useMemo(() => new Map(containersOf(manifest).map((c, i) => [c.id, i])), [manifest]);

  const visible = shown.slice(0, limit);
  const groups = [...groupMatchesByCanvas(visible)].sort(
    (a, b) => (canvasOrder.get(a[0]) ?? Infinity) - (canvasOrder.get(b[0]) ?? Infinity),
  );

  const open = (m: ContentSearchMatch) => {
    setSelected(m.id);
    const box = m.regions.find((r) => r.canvasId === m.canvasId && r.xywh)?.xywh;
    setRequest({ seq: nextSeq(), target: { canvasId: m.canvasId, ...(box ? { xywh: box } : {}) } });
  };

  const clear = () => {
    abort.current?.abort();
    setState(null);
    setText('');
    setSelected(null);
  };

  const copyLink = async () => {
    if (!current) return;
    const u = new URL(window.location.href);
    u.searchParams.set('tab', contentSearchPanel.id);
    u.searchParams.set('q', current.q);
    try {
      await navigator.clipboard.writeText(u.toString());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // クリップボードが使えない環境では何もしない
    }
  };

  if (!service) return null;
  const result = current?.result;
  const listId = `content-search-terms-${manifestId.length}`;

  return (
    <div className="p-3 space-y-3">
      <form
        role="search"
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          search(text);
        }}
      >
        <input
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          list={terms.length > 0 ? listId : undefined}
          placeholder={t('placeholder')}
          aria-label={t('placeholder')}
          className="flex-1 min-w-0 rounded border border-gray-300 dark:border-gray-600 bg-transparent px-2 py-1 text-sm"
        />
        <datalist id={listId}>
          {terms.map((term) => (
            <option key={term.value} value={term.value}>
              {term.count !== undefined ? `${term.label ?? term.value} (${term.count})` : term.label ?? term.value}
            </option>
          ))}
        </datalist>
        <button type="submit" className={PRIMARY} disabled={!text.trim()}>
          {t('search')}
        </button>
      </form>
      <p className="text-xs text-gray-500 dark:text-gray-300">
        {t('about', { version: service.version === 2 ? '2.0' : '1.0' })}
      </p>

      {current?.status === 'error' ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {t('failed')}
        </p>
      ) : null}
      {current && current.status !== 'error' ? (
        <div className="space-y-2" aria-live="polite">
          <p className="text-sm">
            {current.status === 'running' && !result
              ? t('running')
              : t('count', { count: matches.length, total: result?.total ?? matches.length, q: current.q })}
            {current.status === 'running' && result ? ` ${t('loadingMore')}` : null}
          </p>
          {result?.truncated ? <p className="text-xs text-gray-500 dark:text-gray-300">{t('truncated', { count: matches.length })}</p> : null}
          {result && matches.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-1 text-xs">
                <input type="checkbox" checked={showMarks} onChange={(e) => setShowMarks(e.target.checked)} />
                {t('showOnImage')}
              </label>
              <button type="button" className={BUTTON} onClick={copyLink}>
                {copied ? t('copied') : t('copyLink')}
              </button>
              <button type="button" className={BUTTON} onClick={clear}>
                {t('clear')}
              </button>
            </div>
          ) : null}
          {granularities.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1 text-xs" role="group" aria-label={t('granularity')}>
              <span className="text-gray-500 dark:text-gray-300 mr-1">{t('granularity')}</span>
              {[null, ...granularities].map((g) => (
                <button
                  key={g ?? 'all'}
                  type="button"
                  aria-pressed={granularity === g}
                  onClick={() => setGranularity(g)}
                  className={`px-2 py-0.5 rounded-full border ${
                    granularity === g
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  {g === null ? t('granularityAll') : (TEXT_GRANULARITIES as readonly string[]).includes(g) ? t(`granularity_${g}`) : g}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {groups.map(([canvasId, ms]) => (
        <section key={canvasId}>
          <h3
            className={`text-xs font-medium mb-1 ${
              container?.id === canvasId ? 'text-blue-700 dark:text-blue-300' : 'text-gray-600 dark:text-gray-300'
            }`}
          >
            {t('page', { label: canvasLabels.get(canvasId) ?? canvasId, count: ms.length })}
          </h3>
          <ul className="space-y-1">
            {ms.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => open(m)}
                  aria-current={selected === m.id || undefined}
                  className={`w-full text-left rounded border px-2 py-1 text-sm ${
                    selected === m.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                      : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <MatchText match={m} />
                  {m.granularity ? (
                    <span className="ml-2 text-[10px] text-gray-500 dark:text-gray-400">
                      {(TEXT_GRANULARITIES as readonly string[]).includes(m.granularity) ? t(`granularity_${m.granularity}`) : m.granularity}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {shown.length > limit ? (
        <button type="button" className={BUTTON} onClick={() => setLimit((n) => n + LIST_STEP)}>
          {t('more', { count: shown.length - limit })}
        </button>
      ) : null}
    </div>
  );
}

// 文字の検索。マニフェストに検索の窓口（SearchService2 / SearchService1）が書かれているときだけ出す。
export const contentSearchPanel: Panel = {
  id: 'contentSearch',
  // 書き起こし（70）と Canvas の注釈（80）の間
  order: 75,
  available: ({ manifest }) => !!findContentSearchService(manifest),
  Component: ContentSearchPanelBody,
};

