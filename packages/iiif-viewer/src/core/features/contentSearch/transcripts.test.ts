import { describe, expect, it } from 'vitest';
import type { ManifestV4 } from '../../types/iiif';
import { manifestHasSearchableText, searchTranscripts, transcriptFilesOf } from './transcripts';

const VTT = `WEBVTT

00:00:01.000 --> 00:00:04.000
Good manners at lunch

00:01:05.500 --> 00:01:09.000
Wash your hands before LUNCH.
`;

// Cookbook 0219 の形: 動画と、字幕のファイルを指す supplementing の注釈だけ
const captionsOnly = (body: Record<string, unknown>, motivation = 'supplementing') =>
  ({
    type: 'Manifest',
    id: 'm',
    items: [
      {
        id: 'c1',
        type: 'Canvas',
        duration: 572,
        items: [{ id: 'p', type: 'AnnotationPage', items: [{ id: 'a', type: 'Annotation', motivation: ['painting'], body: { id: 'v.mp4', type: 'Video' }, target: 'c1' }] }],
        annotations: [
          {
            id: 'p2',
            type: 'AnnotationPage',
            items: [{ id: 's', type: 'Annotation', motivation: [motivation], provides: ['closedCaptions'], body, target: 'c1' }],
          },
        ],
      },
    ],
  }) as unknown as ManifestV4;

describe('transcriptFilesOf', () => {
  it('WebVTT と text/plain だけを拾う', () => {
    expect(transcriptFilesOf(captionsOnly({ id: 'https://x/cap.vtt', type: 'Text', format: 'text/vtt' }))).toEqual([
      { canvasId: 'c1', url: 'https://x/cap.vtt', format: 'text/vtt' },
    ]);
    expect(transcriptFilesOf(captionsOnly({ id: 'https://x/t.txt', type: 'Text', format: 'text/plain' }))).toHaveLength(1);
    expect(transcriptFilesOf(captionsOnly({ id: 'https://x/cap.srt', type: 'Text', format: 'application/x-subrip' }))).toEqual([]);
  });
});

describe('searchTranscripts', () => {
  it('VTT は台詞ごとに探し、時刻を付ける（大文字小文字は区別しない）', () => {
    const ms = searchTranscripts([{ canvasId: 'c1', url: 'https://x/cap.vtt', format: 'text/vtt', text: VTT }], 'lunch');
    expect(ms.map((m) => [m.match, m.time])).toEqual([
      ['lunch', [1, 4]],
      ['LUNCH', [65.5, 69]],
    ]);
    expect(ms[1].before).toBe('Wash your hands before ');
    expect(ms[0].regions).toEqual([]);
    expect(new Set(ms.map((m) => m.id)).size).toBe(2);
  });

  it('text/plain は行ごとに探し、時刻は付けない', () => {
    const ms = searchTranscripts([{ canvasId: 'c1', url: 'https://x/t.txt', format: 'text/plain', text: 'one\n\nhello world\nHELLO' }], 'hello');
    expect(ms).toHaveLength(2);
    expect(ms.every((m) => m.time === undefined && m.transcript)).toBe(true);
  });

  it('上限で止める', () => {
    expect(searchTranscripts([{ canvasId: 'c1', url: 'u.vtt', text: VTT }], 'lunch', 1)).toHaveLength(1);
  });
});

describe('manifestHasSearchableText', () => {
  it('字幕のファイルが VTT なら探せる', () => {
    expect(manifestHasSearchableText(captionsOnly({ id: 'https://x/cap.vtt', type: 'Text', format: 'text/vtt' }))).toBe(true);
  });

  it('探せない形式のファイルを指す注釈しか無ければ、探せない', () => {
    expect(manifestHasSearchableText(captionsOnly({ id: 'https://x/cap.srt', type: 'Text', format: 'application/x-subrip' }))).toBe(false);
  });

  it('本文のある注釈があれば探せる', () => {
    expect(manifestHasSearchableText(captionsOnly({ type: 'TextualBody', value: 'hello', format: 'text/plain' }, 'commenting'))).toBe(true);
  });
});
