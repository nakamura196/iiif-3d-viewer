'use client';

import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { parseVtt, type VttCue } from '../../core';
import { useTranslations } from '../env';
import type { CaptionTrack } from './MediaView';

// YouTube の動画を YouTube の埋め込みプレーヤーで流す（動画は複製しない）。
// <video> と同じく、再生位置の受け口（mediaRef）と onTimeUpdate を持たせるので、
// 右パネルの文字起こしや時刻つきの注釈は、ふつうの動画と同じように動く。
// 埋め込みプレーヤーには manifest の字幕を渡せないので、字幕は自前で重ねて描く。

interface YTPlayer {
  getCurrentTime(): number;
  getPlayerState(): number;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  playVideo(): void;
  pauseVideo(): void;
  destroy(): void;
  /** not in the documented API, but widely used to hide YouTube's own captions */
  unloadModule?(name: string): void;
  loadModule?(name: string): void;
}

interface YTNamespace {
  Player: new (
    el: HTMLElement,
    opts: {
      host?: string;
      videoId: string;
      width?: string | number;
      height?: string | number;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: (e: { target: YTPlayer }) => void;
        onStateChange?: (e: { data: number; target: YTPlayer }) => void;
        onError?: () => void;
      };
    },
  ) => YTPlayer;
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const PLAYING = 1;

let apiPromise: Promise<YTNamespace> | null = null;

// YouTube の IFrame API は 1 度だけ読み込み、出来上がりを皆で待つ
const loadApi = (): Promise<YTNamespace> => {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<YTNamespace>((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      if (window.YT) resolve(window.YT);
    };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.async = true;
    s.onerror = () => {
      apiPromise = null;
      reject(new Error('YouTube IFrame API'));
    };
    document.head.appendChild(s);
  });
  return apiPromise;
};

interface Props {
  videoId: string;
  /** seconds; where the video opens */
  start?: number;
  tracks?: CaptionTrack[];
  mediaRef: MutableRefObject<HTMLMediaElement | null>;
  onTimeUpdate?: (seconds: number) => void;
}

// YouTube 側の字幕（CC）は、こちらの字幕を出している間は消す（同じ字幕が二重に出ないように）。
// 「字幕なし」を選んだときは戻すので、YouTube の CC ボタンで YouTube の字幕も見られる。
const ownCaptions = (player: YTPlayer, on: boolean) => {
  try {
    if (on) player.unloadModule?.('captions');
    else player.loadModule?.('captions');
  } catch {
    // 非公開の API なので、無ければ何もしない
  }
};

export default function YouTubeView({ videoId, start = 0, tracks = [], mediaRef, onTimeUpdate }: Props) {
  const t = useTranslations('Viewer');
  const host = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [time, setTime] = useState(start);
  const onTime = useRef(onTimeUpdate);
  const playerRef = useRef<YTPlayer | null>(null);
  const showing = useRef(tracks.length > 0);
  useEffect(() => {
    onTime.current = onTimeUpdate;
  }, [onTimeUpdate]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let player: YTPlayer | null = null;
    let ready = false;
    let timer = 0;
    let cancelled = false;
    // 再生前に位置を動かされたら、準備ができたときにそこへ動かす
    let pending: number | null = null;
    const report = (v: number) => {
      setTime(v);
      onTime.current?.(v);
    };
    const target = document.createElement('div');
    el.appendChild(target);

    const proxy = {
      get currentTime() {
        return ready && player ? player.getCurrentTime() : (pending ?? start);
      },
      set currentTime(v: number) {
        if (ready && player) {
          player.seekTo(v, true);
          report(v);
        } else pending = v;
      },
      get paused() {
        return !(ready && player && player.getPlayerState() === PLAYING);
      },
      play() {
        player?.playVideo();
        return Promise.resolve();
      },
      pause() {
        player?.pauseVideo();
      },
    };
    mediaRef.current = proxy as unknown as HTMLMediaElement;

    loadApi()
      .then((YT) => {
        if (cancelled) return;
        player = new YT.Player(target, {
          host: 'https://www.youtube-nocookie.com',
          videoId,
          width: '100%',
          height: '100%',
          playerVars: { rel: 0, playsinline: 1, start: Math.floor(start) },
          events: {
            onReady: (e) => {
              ready = true;
              playerRef.current = e.target;
              if (pending !== null) {
                player?.seekTo(pending, true);
                report(pending);
                pending = null;
              }
            },
            onStateChange: (e) => {
              window.clearInterval(timer);
              report(e.target.getCurrentTime());
              // 字幕の部品は再生を始めたときに読み込まれるので、そのたびに外す
              if (e.data === PLAYING && showing.current) ownCaptions(e.target, true);
              // 再生中は 1 秒に 4 回、位置を知らせる（<video> の timeupdate と同じくらい）
              if (e.data === PLAYING) timer = window.setInterval(() => report(e.target.getCurrentTime()), 250);
            },
            onError: () => setFailed(true),
          },
        });
      })
      .catch(() => setFailed(true));

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      player?.destroy();
      playerRef.current = null;
      target.remove();
      if (mediaRef.current === (proxy as unknown as HTMLMediaElement)) mediaRef.current = null;
    };
  }, [videoId, start, mediaRef]);

  // 字幕: 先頭（端末の言語に合うもの）を既定で出す。切り替えは右上の選択で
  const [chosen, setChosen] = useState(0);
  const [cues, setCues] = useState<Record<string, VttCue[]>>({});
  const track = chosen >= 0 ? tracks[chosen] : undefined;
  useEffect(() => {
    showing.current = !!track;
    if (playerRef.current) ownCaptions(playerRef.current, !!track);
  }, [track]);
  useEffect(() => {
    if (!track || cues[track.url]) return;
    let alive = true;
    fetch(track.url)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then((text) => alive && setCues((c) => ({ ...c, [track.url]: parseVtt(text) })))
      .catch(() => alive && setCues((c) => ({ ...c, [track.url]: [] })));
    return () => {
      alive = false;
    };
  }, [track, cues]);
  const line = useMemo(() => {
    const list = track ? cues[track.url] : undefined;
    if (!list) return '';
    return list
      .filter((c) => c.start <= time && time < c.end)
      .map((c) => c.text)
      .join('\n');
  }, [track, cues, time]);

  if (failed) {
    return <div className="p-4 text-sm text-[var(--ds-fg)]" role="alert">{t('mediaError')}</div>;
  }

  return (
    <div className="w-full h-full flex flex-col bg-black">
      {tracks.length > 0 && (
        <div className="shrink-0 flex justify-end px-2 py-1 text-xs text-white">
          <label className="flex items-center gap-1">
            <span>{t('youTubeCaptions')}</span>
            <select
              className="rounded bg-black text-white border border-white/30 px-1"
              value={chosen}
              onChange={(e) => setChosen(Number(e.target.value))}
            >
              {tracks.map((tr, i) => (
                <option key={tr.url} value={i}>
                  {tr.label}
                </option>
              ))}
              <option value={-1}>{t('youTubeCaptionsOff')}</option>
            </select>
          </label>
        </div>
      )}
      <div className="relative flex-1 min-h-0" style={{ containerType: 'inline-size' }}>
        <div ref={host} className="absolute inset-0 [&>iframe]:w-full [&>iframe]:h-full" />
        {line && (
          <div className="pointer-events-none absolute inset-x-0 bottom-24 flex justify-center px-4">
            <div
              className="max-w-[90%] whitespace-pre-line rounded bg-black/75 px-3 py-1 text-center text-white"
              style={{ fontSize: 'clamp(13px, 2.4cqw, 22px)' }}
            >
              {line}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
