'use client';

import { createContext, useContext, type MutableRefObject } from 'react';

// 再生位置の共有。動画・音声の表示と、右パネルの文字起こしがここでつながる。
export interface Playback {
  mediaRef: MutableRefObject<HTMLMediaElement | null>;
  currentTime: number;
  setCurrentTime: (seconds: number) => void;
  /** Move the media element and the shared position. */
  seek: (seconds: number) => void;
}

const fallback: Playback = {
  mediaRef: { current: null },
  currentTime: 0,
  setCurrentTime: () => {},
  seek: () => {},
};

export const PlaybackContext = createContext<Playback>(fallback);
export const usePlayback = (): Playback => useContext(PlaybackContext);
