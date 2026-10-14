// 音声の波形。accompanyingCanvas（音声と一緒に見せる絵）の無い音声だけの Canvas で、
// 画面が空にならないように、どこで音が鳴っているかを帯で見せる。仕様には決まりが無く、Kasane の判断。

/** Fetch at most this many bytes to draw a waveform; a longer recording keeps only the player. */
export const WAVEFORM_MAX_BYTES = 50 * 1024 * 1024;

/**
 * Reduce the samples of each channel to `buckets` peaks between 0 and 1 (the loudest sample in each slice,
 * over all channels), scaled so that the loudest peak is 1. Silence stays 0.
 */
export function waveformPeaks(channels: ArrayLike<number>[], buckets: number): number[] {
  const length = Math.min(...channels.map((c) => c.length));
  if (!channels.length || !length || buckets <= 0) return [];
  const n = Math.min(buckets, length);
  const peaks = new Array<number>(n).fill(0);
  for (let b = 0; b < n; b++) {
    const start = Math.floor((b * length) / n);
    const end = Math.floor(((b + 1) * length) / n);
    let max = 0;
    for (const c of channels) {
      for (let i = start; i < end; i++) {
        const v = Math.abs(c[i]);
        if (v > max) max = v;
      }
    }
    peaks[b] = max;
  }
  const top = Math.max(...peaks);
  return top > 0 ? peaks.map((p) => p / top) : peaks;
}

/** The media URL without its "#t=" fragment (the fragment is for the player, not for fetching). */
export const withoutFragment = (url: string): string => url.split('#')[0];
