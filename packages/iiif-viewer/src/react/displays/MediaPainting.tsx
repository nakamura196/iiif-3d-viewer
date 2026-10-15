'use client';

import { useEffect, useMemo } from 'react';
import { useAtomValue } from 'jotai';
import {
  captionFilesOf,
  captionKindOf,
  isCaptions,
  labelIn,
  rawContainerOf,
  timedCaptionsOf,
  toWebVtt,
  type ContainerInfo,
  type MediaOption,
} from '../../core';
import { manifestAtom } from '../atoms';
import { useLocale } from '../env';
import { usePlayback } from '../playback';
import MediaView, { type CaptionTrack } from './MediaView';
import { useReferencedPages } from './useReferencedPages';
import VideoAnnotations from './VideoAnnotations';

// 動画・音声（選ばれた中身）の表示。字幕は <track> に渡す。
// 字幕は共有の読み取り（supplementing）に加えて、Choice に入った複数言語の字幕（0074）も、
// manifest の素のデータから足す。言語の切り替えは動画の標準の字幕メニューで行う。
// 時刻つきの注釈で書かれた字幕（0079。参照だけのページにあることが多い）は、
// WebVTT に組み立て直して <track> に渡す。
export default function MediaPainting({
  container,
  option,
}: {
  container: ContainerInfo;
  option: MediaOption & { kind: 'Video' | 'Audio' };
}) {
  const locale = useLocale();
  const manifest = useAtomValue(manifestAtom);
  const { mediaRef, setCurrentTime } = usePlayback();

  const tracks: CaptionTrack[] = container.supplementing.filter(isCaptions).map((s) => ({
    url: s.url,
    language: s.language[0],
    label: labelIn(s.label, locale) || s.language[0] || 'captions',
    kind: captionKindOf(s.provides),
  }));
  const raw = rawContainerOf(manifest, container.id);
  for (const f of captionFilesOf(raw)) {
    if (tracks.some((t) => t.url === f.url)) continue;
    tracks.push({
      url: f.url,
      language: f.language,
      label: labelIn(f.label, locale) || f.language || 'captions',
      kind: f.kind,
    });
  }

  const resolved = useReferencedPages(raw);
  const annotated = useMemo(
    () =>
      timedCaptionsOf(resolved).map((g) => ({
        url: URL.createObjectURL(new Blob([toWebVtt(g.cues)], { type: 'text/vtt' })),
        language: g.language,
        label: g.language || 'captions',
        kind: g.kind,
      })),
    [resolved],
  );
  useEffect(() => () => annotated.forEach((t) => URL.revokeObjectURL(t.url)), [annotated]);
  tracks.push(...annotated);
  // 端末の言語に合う字幕を最初に出す（default は先頭の 1 つ）
  const lang = locale.split('-')[0];
  tracks.sort((a, b) => Number(b.language?.split('-')[0] === lang) - Number(a.language?.split('-')[0] === lang));

  return (
    <MediaView
      kind={option.kind}
      src={option.url}
      format={option.format}
      width={container.width}
      height={container.height}
      tracks={tracks}
      mediaRef={mediaRef}
      onTimeUpdate={setCurrentTime}
      overlay={option.kind === 'Video' && container.kind === 'Canvas' ? <VideoAnnotations container={container} /> : undefined}
    />
  );
}
