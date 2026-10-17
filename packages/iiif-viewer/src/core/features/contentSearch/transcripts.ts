// 字幕・文字起こしのファイル（supplementing の WebVTT と text/plain）の中を探す。React に依存しない。
//
// 対象は「文字起こし」タブが表示できる 2 つの形式だけ（SRT・TTML・HTML は探さない。当たっても見る場所が無いため）。
// - WebVTT: 台詞（cue）ごとに探し、当たりに時刻を付ける。押すとその時刻へ移る
// - text/plain: 行ごとに探す。時刻は無い
// 大文字と小文字、全角と半角の違いは、注釈の検索と同じく無視する。

import { containersOf } from '../../services/containers';
import { isVtt } from '../../transcript';
import { parseVtt } from '../../vtt';
import { annotationSourcesOf, canvasIdsOf, manifestItemsOf, readCanvasAnnotations } from '../annotations';
import type { ManifestV4 } from '../../types/iiif';
import type { ContentSearchMatch } from './index';
import { annotationPlainText, foldForSearch } from './local';

const CONTEXT_CHARS = 30;

/** 探す対象のファイル 1 つ。 */
export interface TranscriptFile {
  canvasId: string;
  url: string;
  format?: string;
}

/** 読み込んだファイル。 */
export interface TranscriptSource extends TranscriptFile {
  text: string;
}

const isPlainText = (s: { url: string; format?: string }): boolean =>
  s.format === 'text/plain' || (!s.format && /\.txt(\?|$)/i.test(s.url));

/** 資料の各 Canvas に付いた、探せる字幕・文字起こしのファイル（同じ Canvas の同じ URL は 1 回）。 */
export function transcriptFilesOf(manifest: ManifestV4 | null | undefined): TranscriptFile[] {
  const out: TranscriptFile[] = [];
  const seen = new Set<string>();
  for (const c of containersOf(manifest)) {
    if (c.kind !== 'Canvas') continue;
    for (const s of c.supplementing) {
      if (!s.url || !(isVtt(s) || isPlainText(s))) continue;
      const key = `${c.id}|${s.url}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ canvasId: c.id, url: s.url, ...(s.format ? { format: s.format } : {}) });
    }
  }
  return out;
}

const looksVtt = (s: TranscriptSource): boolean =>
  s.format === 'text/vtt' || /\.vtt(\?|$)/i.test(s.url) || s.text.trimStart().startsWith('WEBVTT');

/** 探す単位（VTT は台詞、text/plain は行）。 */
const unitsOf = (s: TranscriptSource): { text: string; time?: [number, number] }[] =>
  looksVtt(s)
    ? parseVtt(s.text).map((c) => ({ text: c.text.replace(/\s+/g, ' ').trim(), time: [c.start, c.end] as [number, number] }))
    : s.text.split(/\r?\n/).map((line) => ({ text: line.trim() }));

/** 字幕・文字起こしのファイルから語を探す。1 つの台詞（行）に何度も出れば、出た数だけ当たりにする。 */
export function searchTranscripts(sources: TranscriptSource[], q: string, maxMatches = 2000): ContentSearchMatch[] {
  const needle = foldForSearch(q.trim()).folded;
  if (!needle) return [];
  const out: ContentSearchMatch[] = [];
  for (const s of sources) {
    unitsOf(s).forEach((u, n) => {
      if (!u.text || out.length >= maxMatches) return;
      const { folded, at } = foldForSearch(u.text);
      for (let from = 0; out.length < maxMatches; ) {
        const hit = folded.indexOf(needle, from);
        if (hit < 0) break;
        from = hit + needle.length;
        const start = at[hit];
        const end = at[hit + needle.length];
        const before = u.text.slice(Math.max(0, start - CONTEXT_CHARS), start);
        const after = u.text.slice(end, end + CONTEXT_CHARS);
        out.push({
          id: `${s.url}#${u.time ? `t=${u.time[0]}` : `line=${n + 1}`}&search=${start}`,
          canvasId: s.canvasId,
          // 画像の上に印は出さない（動画・音声の Canvas に枠を出しても意味が無いため）
          regions: [],
          match: u.text.slice(start, end),
          ...(before ? { before } : {}),
          ...(after ? { after } : {}),
          ...(u.time ? { time: u.time } : {}),
          transcript: true,
        });
      }
    });
    if (out.length >= maxMatches) break;
  }
  return out;
}

const searchableCache = new WeakMap<object, boolean>();

/**
 * 手元で探せる文字が資料にあるか（検索のタブを出すかどうかに使う）。
 * 本文のある注釈、参照だけの注釈のページ（中身は開くまで分からないので、あるものとみなす）、
 * 探せる字幕・文字起こしのファイルのどれか。字幕のファイルを指すだけの注釈は数えない。
 */
export function manifestHasSearchableText(manifest: ManifestV4 | null | undefined): boolean {
  if (!manifest || typeof manifest !== 'object') return false;
  let v = searchableCache.get(manifest);
  if (v === undefined) {
    const canvasIds = canvasIdsOf(manifest);
    v =
      transcriptFilesOf(manifest).length > 0 ||
      manifestItemsOf(manifest).some((c) => {
        const canvasId = typeof c?.id === 'string' ? c.id : undefined;
        if (!canvasId) return false;
        const src = annotationSourcesOf(c);
        if (src.references.length > 0) return true;
        return readCanvasAnnotations(canvasId, src.pages, {}, canvasIds).some((a) => annotationPlainText(a) !== '');
      });
    searchableCache.set(manifest, v);
  }
  return v;
}
