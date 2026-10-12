'use client';

import { useAtomValue } from 'jotai';
import {
  captionFilesOf,
  isCaptions,
  labelIn,
  rawContainerOf,
  type ContainerInfo,
  type MediaOption,
} from '../../core';
import { manifestAtom } from '../atoms';
import { useLocale } from '../env';
import { usePlayback } from '../playback';
import MediaView, { type CaptionTrack } from './MediaView';

// 動画・音声（選ばれた中身）の表示。字幕は <track> に渡す。
// 字幕は共有の読み取り（supplementing）に加えて、Choice に入った複数言語の字幕（0074）も、
// manifest の素のデータから足す。言語の切り替えは動画の標準の字幕メニューで行う。
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
  }));
  const raw = rawContainerOf(manifest, container.id);
  for (const f of captionFilesOf(raw)) {
    if (tracks.some((t) => t.url === f.url)) continue;
    tracks.push({
      url: f.url,
      language: f.language,
      label: labelIn(f.label, locale) || f.language || 'captions',
    });
  }
  // 端末の言語に合う字幕を最初に出す（default は先頭の 1 つ）
  const lang = locale.split('-')[0];
  tracks.sort((a, b) => Number(b.language?.split('-')[0] === lang) - Number(a.language?.split('-')[0] === lang));

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
