'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { WAVEFORM_MAX_BYTES, waveformPeaks, withoutFragment } from '../../core/waveform';
import { useTranslations } from '../env';
import { usePlayback } from '../playback';

const BUCKETS = 600;

interface Wave {
  peaks: number[];
  duration: number;
}

// 音声ファイルを読み込み、波形にする。読めないとき（他のサイトが読み込みを許していない・大きすぎる・
// 形式を解けない）は null を返し、波形を出さずに再生バーだけにする。
async function loadWave(src: string, signal: AbortSignal): Promise<Wave | null> {
  const res = await fetch(withoutFragment(src), { signal });
  if (!res.ok) return null;
  const size = Number(res.headers.get('content-length'));
  if (size > WAVEFORM_MAX_BYTES) {
    res.body?.cancel().catch(() => {});
    return null;
  }
  const bytes = await res.arrayBuffer();
  if (bytes.byteLength > WAVEFORM_MAX_BYTES) return null;
  const ctx = new AudioContext();
  try {
    const audio = await ctx.decodeAudioData(bytes);
    const channels = Array.from({ length: audio.numberOfChannels }, (_, i) =>
      audio.getChannelData(i)
    );
    return { peaks: waveformPeaks(channels, BUCKETS), duration: audio.duration };
  } finally {
    ctx.close().catch(() => {});
  }
}

/**
 * The waveform of a sound above its player: shows where it is loud and moves the player when clicked.
 * Without a waveform (not loaded yet, or not readable) the player is shown alone, as before.
 */
export default function Waveform({ src, player }: { src: string; player: ReactNode }) {
  const t = useTranslations('Viewer');
  const { currentTime, seek } = usePlayback();
  const [wave, setWave] = useState<{ src: string; wave: Wave | null } | null>(null);

  useEffect(() => {
    const ctl = new AbortController();
    loadWave(src, ctl.signal)
      .then((w) => setWave({ src, wave: w }))
      .catch(() => {
        if (!ctl.signal.aborted) setWave({ src, wave: null });
      });
    return () => ctl.abort();
  }, [src]);

  const loaded = wave?.src === src ? wave.wave : null;
  const w = loaded && loaded.peaks.length > 0 ? loaded : null;
  // the player stays in the same place whether or not a waveform is shown, so that loading the waveform
  // does not rebuild the player (and stop a sound that is already playing)
  if (!w) return <Layout waveform={null} player={player} />;

  const duration = w.duration;
  const played = duration > 0 ? Math.min(1, currentTime / duration) : 0;
  const n = w.peaks.length;
  const bars = (fill: string) =>
    w.peaks.map((p, i) => {
      const h = Math.max(0.02, p);
      return <rect key={i} x={i + 0.15} width={0.7} y={(1 - h) / 2} height={h} style={{ fill }} />;
    });

  const seekAt = (clientX: number, el: Element) => {
    const r = el.getBoundingClientRect();
    if (r.width > 0) seek(Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * duration);
  };

  return (
    <Layout
      player={player}
      waveform={
        <svg
          className="block w-full h-full cursor-pointer"
          viewBox={`0 0 ${n} 1`}
          preserveAspectRatio="none"
          role="slider"
          tabIndex={0}
          aria-label={t('waveform')}
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(currentTime)}
          onClick={(e) => seekAt(e.clientX, e.currentTarget)}
          onKeyDown={(e) => {
            const step = e.key === 'ArrowRight' ? 5 : e.key === 'ArrowLeft' ? -5 : 0;
            if (!step) return;
            e.preventDefault();
            seek(Math.max(0, Math.min(duration, currentTime + step)));
          }}
        >
          <defs>
            <clipPath id="kasane-waveform-played">
              <rect x={0} y={0} width={played * n} height={1} />
            </clipPath>
          </defs>
          <g style={{ opacity: 0.35 }}>{bars('var(--ds-fg)')}</g>
          <g clipPath="url(#kasane-waveform-played)">{bars('var(--ds-primary)')}</g>
        </svg>
      }
    />
  );
}

function Layout({ waveform, player }: { waveform: ReactNode; player: ReactNode }) {
  // with a waveform: the waveform and the player together in the middle; without: the player alone, as before
  return (
    <div
      className={
        waveform
          ? 'flex-1 min-h-0 min-w-0 flex flex-col items-center justify-center'
          : 'flex-1 min-h-0 min-w-0 flex flex-col'
      }
    >
      {waveform && <div className="w-full max-w-3xl h-40 px-4">{waveform}</div>}
      <div className={waveform ? 'w-full shrink-0 flex flex-col' : 'flex-1 min-h-0 flex flex-col'}>
        {player}
      </div>
    </div>
  );
}
