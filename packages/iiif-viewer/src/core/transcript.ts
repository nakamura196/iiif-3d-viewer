// Which supplementing content is shown as the transcript list next to a video or audio.
import type { SupplementingContent } from './services/containers';

export const isVtt = (s: SupplementingContent): boolean =>
  s.format === 'text/vtt' || /\.vtt(\?|$)/i.test(s.url);

/** A WebVTT file given as closed captions or subtitles (it is also used as `<track>`). */
export const isCaptions = (s: SupplementingContent): boolean =>
  isVtt(s) && s.provides.some((p) => p === 'closedCaptions' || p === 'subtitles');

const isExplicitTranscript = (s: SupplementingContent): boolean => s.provides.includes('transcript');

const isUnlabelledText = (s: SupplementingContent): boolean =>
  s.provides.length === 0 && (s.format === 'text/plain' || isVtt(s));

/**
 * The content to list as a transcript. An explicit transcript wins; otherwise an
 * unlabelled text/plain or VTT; otherwise a caption VTT (it has times, so it can be
 * listed with the current line highlighted and clicked to seek).
 */
export const transcriptOf = (
  supplementing: SupplementingContent[]
): SupplementingContent | undefined =>
  supplementing.find(isExplicitTranscript) ??
  supplementing.find(isUnlabelledText) ??
  supplementing.find(isCaptions);
