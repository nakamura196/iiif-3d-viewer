'use client';

import { useRef, useState, type MutableRefObject } from 'react';
import { useTranslations } from '../env';

export interface CaptionTrack {
  url: string;
  language?: string;
  label: string;
  /** "subtitles" when the manifest says `provides: ["subtitles"]` (v4); otherwise "captions" */
  kind?: 'captions' | 'subtitles';
}

interface Props {
  kind: 'Video' | 'Audio';
  src: string;
  format?: string;
  width?: number;
  height?: number;
  tracks?: CaptionTrack[];
  /** Filled with the media element so that a transcript can move the position. */
  mediaRef: MutableRefObject<HTMLMediaElement | null>;
  onTimeUpdate?: (seconds: number) => void;
}

/** Where a video is moved before playing, so that its first frame is drawn (seconds). */
export const FIRST_FRAME = 0.001;

// <video controls> (with captions as <track>) or <audio controls>.
export default function MediaView({ kind, src, format, tracks = [], mediaRef, onTimeUpdate }: Props) {
  const t = useTranslations('Viewer');
  const [failed, setFailed] = useState<string | null>(null);
  // 再生前の動画が黒いままにならないよう、読み込んだら少しだけ進めて最初のフレームを描かせる。
  // この移動は再生位置として知らせない（表紙が消えたり、文字起こしが動いたりしないように）。
  const nudging = useRef(false);

  if (failed === src) {
    return <div className="p-4 text-sm text-[var(--ds-fg)]" role="alert">{t('mediaError')}</div>;
  }

  const common = {
    controls: true,
    onError: () => setFailed(src),
    onTimeUpdate: (e: React.SyntheticEvent<HTMLMediaElement>) => {
      if (!nudging.current) onTimeUpdate?.(e.currentTarget.currentTime);
    },
    onSeeked: (e: React.SyntheticEvent<HTMLMediaElement>) => {
      if (nudging.current) {
        nudging.current = false;
        return;
      }
      onTimeUpdate?.(e.currentTarget.currentTime);
    },
  };

  if (kind === 'Audio') {
    return (
      <div className="w-full h-full flex items-center justify-center p-4">
        <audio
          key={src}
          ref={(el) => {
            mediaRef.current = el;
          }}
          className="w-full max-w-xl"
          preload="metadata"
          {...common}
        >
          <source src={src} type={format} />
        </audio>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center bg-black">
      <video
        key={src}
        ref={(el) => {
          mediaRef.current = el;
        }}
        className="w-full h-full object-contain"
        crossOrigin="anonymous"
        preload="metadata"
        onLoadedMetadata={(e) => {
          const el = e.currentTarget;
          if (el.paused && el.currentTime === 0) {
            nudging.current = true;
            el.currentTime = FIRST_FRAME;
          }
        }}
        {...common}
      >
        <source src={src} type={format} />
        {tracks.map((tr, i) => (
          <track
            key={tr.url}
            kind={tr.kind ?? 'captions'}
            src={tr.url}
            srcLang={tr.language}
            label={tr.label}
            default={i === 0}
          />
        ))}
      </video>
    </div>
  );
}
