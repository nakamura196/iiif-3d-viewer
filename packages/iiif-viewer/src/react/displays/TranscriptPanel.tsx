'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { parseVtt } from '../../core';
import { useTranslations } from '../env';

interface Props {
  url: string;
  format?: string;
  /** Current playback position in seconds (used to highlight the cue). */
  currentTime?: number;
  /** Called with a cue's start time when it is clicked. */
  onSeek?: (seconds: number) => void;
}

type Loaded = { url: string; text: string } | { url: string; error: true };

const fmt = (s: number) => {
  const total = Math.floor(s);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
};

// A transcript file: WebVTT as clickable cues (the playing one is highlighted),
// anything else as preformatted text.
export default function TranscriptPanel({ url, format, currentTime = 0, onSeek }: Props) {
  const t = useTranslations('Transcript');
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.text();
      })
      .then((text) => !cancelled && setLoaded({ url, text }))
      .catch(() => !cancelled && setLoaded({ url, error: true }));
    return () => {
      cancelled = true;
    };
  }, [url]);

  const current = loaded?.url === url ? loaded : null;
  const failed = current !== null && 'error' in current;
  const text = current && 'text' in current ? current.text : null;
  const isVtt = format === 'text/vtt' || /\.vtt(\?|$)/i.test(url) || (text?.trimStart().startsWith('WEBVTT') ?? false);
  const cues = useMemo(() => (text && isVtt ? parseVtt(text) : []), [text, isVtt]);

  // the cue being played: the last one that has started and not yet ended
  let active = -1;
  for (let i = 0; i < cues.length; i++) {
    if (cues[i].start <= currentTime && currentTime < cues[i].end) active = i;
  }

  useEffect(() => {
    const box = listRef.current;
    const el = active >= 0 ? box?.querySelector<HTMLElement>(`[data-cue="${active}"]`) : null;
    if (!box || !el) return;
    const top = el.offsetTop - box.offsetTop;
    if (top < box.scrollTop || top + el.offsetHeight > box.scrollTop + box.clientHeight) {
      box.scrollTop = top - box.clientHeight / 3;
    }
  }, [active]);

  if (!current) return <div className="p-4 text-sm text-[var(--ds-fg)]">{t('loading')}</div>;
  if (failed || text === null) return <div className="p-4 text-sm text-[var(--ds-fg)]" role="alert">{t('error')}</div>;

  if (!isVtt || cues.length === 0) {
    return text.trim() ? (
      <pre className="p-4 text-sm whitespace-pre-wrap break-words text-[var(--ds-fg)] font-sans">{text}</pre>
    ) : (
      <div className="p-4 text-sm text-[var(--ds-fg)]">{t('empty')}</div>
    );
  }

  return (
    <div ref={listRef} className="relative h-full overflow-y-auto p-2">
      {cues.map((cue, i) => (
        <button
          key={i}
          data-cue={i}
          onClick={() => onSeek?.(cue.start)}
          className={`w-full text-left flex gap-2 px-2 py-1 rounded text-sm transition-colors ${
            i === active
              ? 'bg-blue-600 text-white'
              : 'text-[var(--ds-fg)] hover:bg-[var(--ds-surface-2)]'
          }`}
        >
          <span className="shrink-0 tabular-nums opacity-70">{fmt(cue.start)}</span>
          <span className="whitespace-pre-line">{cue.text}</span>
        </button>
      ))}
    </div>
  );
}
