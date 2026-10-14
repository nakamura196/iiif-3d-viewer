'use client';

import { transcriptOf } from '../../core';
import TranscriptPanel from '../displays/TranscriptPanel';
import { usePlayback } from '../playback';
import type { Panel, PanelContext } from './types';

function TranscriptTab({ container }: PanelContext) {
  const { currentTime, seek } = usePlayback();
  const transcript = transcriptOf(container?.supplementing ?? []);
  if (!transcript) return null;
  return (
    <TranscriptPanel
      key={transcript.url}
      url={transcript.url}
      format={transcript.format}
      currentTime={currentTime}
      onSeek={seek}
    />
  );
}

export const transcriptPanel: Panel = {
  id: 'transcript',

  order: 60,
  available: ({ container }) => !!transcriptOf(container?.supplementing ?? []),
  Component: TranscriptTab,
};
