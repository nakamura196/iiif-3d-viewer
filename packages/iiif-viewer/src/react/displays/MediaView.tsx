'use client';

import { useState, type MutableRefObject } from 'react';
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

// <video controls> (with captions as <track>) or <audio controls>.
export default function MediaView({ kind, src, format, tracks = [], mediaRef, onTimeUpdate }: Props) {
  const t = useTranslations('Viewer');
  const [failed, setFailed] = useState<string | null>(null);

  if (failed === src) {
    return <div className="p-4 text-sm text-[var(--ds-fg)]" role="alert">{t('mediaError')}</div>;
  }

  const common = {
    controls: true,
    onError: () => setFailed(src),
    onTimeUpdate: (e: React.SyntheticEvent<HTMLMediaElement>) => onTimeUpdate?.(e.currentTarget.currentTime),
    onSeeked: (e: React.SyntheticEvent<HTMLMediaElement>) => onTimeUpdate?.(e.currentTarget.currentTime),
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
