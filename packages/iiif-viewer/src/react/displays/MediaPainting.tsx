'use client';

import { isCaptions, labelIn, type ContainerInfo, type MediaOption } from '../../core';
import { useLocale } from '../env';
import { usePlayback } from '../playback';
import MediaView, { type CaptionTrack } from './MediaView';

// 動画・音声（選ばれた中身）の表示。字幕は <track> に渡す。
export default function MediaPainting({
  container,
  option,
}: {
  container: ContainerInfo;
  option: MediaOption & { kind: 'Video' | 'Audio' };
}) {
  const locale = useLocale();
  const { mediaRef, setCurrentTime } = usePlayback();
  const tracks: CaptionTrack[] = container.supplementing.filter(isCaptions).map((s) => ({
    url: s.url,
    language: s.language[0],
    label: labelIn(s.label, locale) || s.language[0] || 'captions',
  }));
  return (
    <MediaView
      kind={option.kind}
      src={option.url}
      format={option.format}
      tracks={tracks}
      mediaRef={mediaRef}
      onTimeUpdate={setCurrentTime}
    />
  );
}
