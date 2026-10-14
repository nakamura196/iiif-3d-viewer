import { describe, expect, it } from 'vitest';
import { waveformPeaks, withoutFragment } from './waveform';

describe('waveformPeaks', () => {
  it('takes the loudest sample in each slice and scales the loudest to 1', () => {
    expect(waveformPeaks([[0, 0.1, -0.5, 0.2, 0.25, 0]], 3)).toEqual([0.2, 1, 0.5]);
  });

  it('reads every channel', () => {
    expect(
      waveformPeaks(
        [
          [0.1, 0],
          [0, -0.4],
        ],
        2
      )
    ).toEqual([0.25, 1]);
  });

  it('keeps silence at 0', () => {
    expect(waveformPeaks([[0, 0, 0, 0]], 2)).toEqual([0, 0]);
  });

  it('gives no more peaks than samples, and none for empty input', () => {
    expect(waveformPeaks([[0.5, 1]], 10)).toEqual([0.5, 1]);
    expect(waveformPeaks([], 10)).toEqual([]);
    expect(waveformPeaks([[]], 10)).toEqual([]);
  });
});

describe('withoutFragment', () => {
  it('drops a media fragment', () => {
    expect(withoutFragment('https://example.org/a.mp4#t=10,20')).toBe('https://example.org/a.mp4');
    expect(withoutFragment('https://example.org/a.mp4')).toBe('https://example.org/a.mp4');
  });
});
