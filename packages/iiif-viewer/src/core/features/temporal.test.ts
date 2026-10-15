import { describe, expect, it } from 'vitest';
import r0017 from './__fixtures__/temporal/0017.json';
import r0074 from './__fixtures__/temporal/0074.json';
import r0074v4 from './__fixtures__/temporal/0074-v4.json';
import r0079v4 from './__fixtures__/temporal/0079-v4.json';
import r0079v4page from './__fixtures__/temporal/0079-v4-captions.page.json';
import r0103 from './__fixtures__/temporal/0103.json';
import r0434 from './__fixtures__/temporal/0434.json';
import r0489 from './__fixtures__/temporal/0489.json';
import r0560 from './__fixtures__/temporal/0560.json';
import { containersOf } from '../services/containers';
import { convertToV4 } from '../services/manifestConverter';
import type { ManifestV4 } from '../types/iiif';
import {
  activeItemsAt,
  captionFilesOf,
  isComposite,
  mediaTimeAt,
  parseRegionFragment,
  parseTimeFragment,
  plainText,
  rawContainerOf,
  renderingTranscriptOf,
  sanitizeTemporalHtml,
  targetRegionOf,
  targetTimeOf,
  timedCaptionsOf,
  timedTextsOf,
  timelineImageUrl,
  timelineOf,
  toWebVtt,
} from './temporal';

// the viewer reads a v3 manifest through convertToV4, so the tests do the same
const first = (raw: unknown) => {
  const m = convertToV4(raw) as ManifestV4;
  const id = (m.items[0] as { id: string }).id;
  return { manifest: m, container: rawContainerOf(m, id) };
};

describe('parseTimeFragment', () => {
  it('t=開始,終了', () => {
    expect(parseTimeFragment('https://e.org/c#t=11,42')).toEqual({ start: 11, end: 42 });
    expect(parseTimeFragment('t=npt:10.5,20')).toEqual({ start: 10.5, end: 20 });
  });
  it('xywh と並ぶ指定', () => {
    expect(parseTimeFragment('https://e.org/c#xywh=1,2,3,4&t=1,2')).toEqual({ start: 1, end: 2 });
  });
  it('開始だけ・終了だけ・時分秒', () => {
    expect(parseTimeFragment('#t=5')).toEqual({ start: 5 });
    expect(parseTimeFragment('#t=,9')).toEqual({ start: 0, end: 9 });
    expect(parseTimeFragment('#t=,')).toBeNull();
    expect(parseTimeFragment('#t=0:01:30,0:02:00')).toEqual({ start: 90, end: 120 });
  });
  it('時間が無い・壊れている指定は null', () => {
    expect(parseTimeFragment('https://e.org/c')).toBeNull();
    expect(parseTimeFragment('#xywh=1,2,3,4')).toBeNull();
    expect(parseTimeFragment('#t=abc')).toBeNull();
  });
  it('終了が開始以下なら開始だけ', () => {
    expect(parseTimeFragment('#t=10,5')).toEqual({ start: 10 });
  });
});

describe('target', () => {
  it('SpecificResource の FragmentSelector と PointSelector', () => {
    const t = { type: 'SpecificResource', source: 'https://e.org/c', selector: [{ type: 'FragmentSelector', value: 't=3,4' }] };
    expect(targetTimeOf(t)).toEqual({ start: 3, end: 4 });
    expect(targetTimeOf({ type: 'SpecificResource', source: 'x', selector: { type: 'PointSelector', instant: 7 } })).toEqual({ start: 7 });
  });
  it('領域', () => {
    expect(parseRegionFragment('#xywh=pixel:1,2,3,4')).toEqual({ x: 1, y: 2, w: 3, h: 4 });
    expect(targetRegionOf('https://e.org/c#xywh=10,20,30,40&t=0,1')).toEqual({ x: 10, y: 20, w: 30, h: 40 });
    expect(parseRegionFragment('#xywh=percent:1,2,3,4')).toBeNull();
  });
});

describe('timelineOf（0560: 画像が時間で入れ替わる）', () => {
  const { container, manifest } = first(r0560);
  const tl = timelineOf(container, manifest)!;
  it('2 枚が 0-2 秒・2-4 秒', () => {
    expect(tl.duration).toBe(4);
    expect(tl.repeat).toBe(true);
    expect(tl.items.map((i) => [i.start, i.end])).toEqual([[0, 2], [2, 4]]);
    expect(isComposite(tl)).toBe(true);
  });
  it('時刻でどちらが出るか', () => {
    expect(activeItemsAt(tl, 1).map((i) => i.id)).toHaveLength(1);
    expect(activeItemsAt(tl, 1)[0].id).toContain('p1a1');
    expect(activeItemsAt(tl, 2)[0].id).toContain('p1a2');
    expect(activeItemsAt(tl, 4)[0].id).toContain('p1a2');
  });
  it('サービスがあれば大きさ指定の URL', () => {
    expect(timelineImageUrl(tl.items[0], 1000)).toMatch(/\/full\/1000,\/0\/default\.jpg$/);
  });
});

describe('timelineOf（0489: 画像・動画・テキストが 1 つの Canvas に）', () => {
  const { container } = first(r0489);
  const tl = timelineOf(container)!;
  it('5 つの本体と領域', () => {
    expect(tl.items).toHaveLength(5);
    expect(tl.duration).toBe(180);
    expect(tl.width).toBe(70399);
    const video = tl.items.find((i) => i.kind === 'Video')!;
    expect(video.start).toBe(11);
    expect(video.end).toBe(42);
    expect(video.region).toEqual({ x: 1000, y: 500, w: 5000, h: 6000 });
    expect(tl.items.filter((i) => i.kind === 'Text')).toHaveLength(3);
    expect(isComposite(tl)).toBe(true);
  });
  it('0 秒は「Press Play」だけ、20 秒は画像と動画', () => {
    expect(activeItemsAt(tl, 0).map((i) => i.kind)).toEqual(['Text']);
    expect(activeItemsAt(tl, 20).map((i) => i.kind).sort()).toEqual(['Image', 'Video']);
  });
  it('動画の中の位置は、出始めの時刻からの経過', () => {
    const video = tl.items.find((i) => i.kind === 'Video')!;
    expect(mediaTimeAt(video, 15)).toBe(4);
  });
});

describe('Choice の音声（0434）と単独の動画（0017）は合成にしない', () => {
  it('0434', () => {
    const tl = timelineOf(first(r0434).container)!;
    expect(tl.items).toHaveLength(6);
    expect(tl.items.every((i) => i.choiceId && i.kind === 'Audio')).toBe(true);
    expect(isComposite(tl)).toBe(false);
    // containers.ts の painting の id と一致する（ChoiceBar の選択を引くため）
    const info = containersOf(first(r0434).manifest)[0];
    expect(tl.items[0].choiceId).toBe(info.painting[0].id);
  });
  it('0017', () => {
    expect(isComposite(timelineOf(first(r0017).container))).toBe(false);
  });
});

describe('timedTextsOf（0103）', () => {
  it('範囲も指す注釈（#t=…&xywh=…、動画の中の物）は文字起こしに入れない', () => {
    const c = {
      annotations: [
        {
          items: [
            { id: 'a', body: { type: 'TextualBody', value: 'Person' }, target: 'c#t=1,2&xywh=0,0,10,10' },
            { id: 'b', body: { type: 'TextualBody', value: 'Hello' }, target: 'c#t=3,4' },
          ],
        },
      ],
    };
    expect(timedTextsOf(c).map((t) => t.id)).toEqual(['b']);
  });
  it('時刻つきの TextualBody を一覧にする', () => {
    const texts = timedTextsOf(first(r0103).container);
    expect(texts).toHaveLength(1);
    expect(texts[0]).toMatchObject({ start: 702, end: 705, text: 'Soft laughter, rustling' });
    expect(texts[0].group).toEqual({ en: ['Environmental Noise'] });
  });
  it('終了の無いものは次の開始まで・時間の無いものは入れない・開始順に並ぶ', () => {
    const c = {
      duration: 100,
      annotations: [
        {
          items: [
            { id: 'b', motivation: 'commenting', body: { type: 'TextualBody', value: 'B' }, target: 'c#t=20' },
            { id: 'a', motivation: 'commenting', body: { type: 'TextualBody', value: '<p>A</p>', format: 'text/html' }, target: 'c#t=10' },
            { id: 'x', motivation: 'commenting', body: { type: 'TextualBody', value: 'no time' }, target: 'c' },
          ],
        },
      ],
    };
    const t = timedTextsOf(c);
    expect(t.map((x) => [x.text, x.start, x.end])).toEqual([['A', 10, 20], ['B', 20, 100]]);
  });
});

describe('captionFilesOf（0074）と renderingTranscriptOf（0017）', () => {
  it('Choice の中の言語別の字幕を読む', () => {
    const files = captionFilesOf(first(r0074).container);
    expect(files.map((f) => f.language)).toEqual(['en', 'it']);
    expect(files[0].url).toMatch(/_en\.vtt$/);
  });
  it('rendering の Text', () => {
    expect(renderingTranscriptOf(first(r0017).container)).toMatchObject({
      format: 'text/plain',
      url: expect.stringMatching(/volleyball\.txt$/),
    });
  });
});

describe('v4 の字幕（Cookbook PR #621 の 0074・#622 の 0079）', () => {
  it('0074 v4: 注釈ごとの VTT を読み、provides で字幕の種類を分ける', () => {
    const files = captionFilesOf(first(r0074v4).container);
    expect(files.map((f) => [f.language, f.kind])).toEqual([
      ['en', 'subtitles'],
      ['it', 'captions'],
    ]);
  });
  it('0079 v4: 参照先のページを足すと、時刻つきの注釈が字幕になる', () => {
    const { container } = first(r0079v4);
    // 参照だけのうちは何も無い（取得は画面側の仕事）
    expect(timedCaptionsOf(container)).toEqual([]);
    const resolved = { ...container, annotations: [...(container?.annotations as unknown[]), r0079v4page] };
    const groups = timedCaptionsOf(resolved);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ language: 'en', kind: 'captions' });
    expect(groups[0].cues).toHaveLength(9);
    expect(groups[0].cues[0]).toMatchObject({ start: 1.2, end: 21, text: '[music]' });
  });
  it('toWebVtt: 時刻を書式どおりに、本文の --> と空行は崩さない', () => {
    const vtt = toWebVtt([
      { id: 'a', start: 1.2, end: 3661.5, text: 'a --> b\n\n<i>c</i> & d', provides: [] },
    ]);
    expect(vtt).toBe('WEBVTT\n\n00:00:01.200 --> 01:01:01.500\na --&gt; b\n&lt;i>c&lt;/i> &amp; d\n');
  });
});

describe('sanitizeTemporalHtml / plainText', () => {
  it('script・イベント属性・画像を落とし、見た目の指定だけ残す', () => {
    const out = sanitizeTemporalHtml(
      `<p style='font-size:2000px;background:url(x)' onclick="x()">Hi<script>alert(1)</script><img src=x></p>`
    );
    expect(out).toBe('<p style="font-size:2000px">Hialert(1)</p>');
  });
  it('リンクは http(s) だけ', () => {
    expect(sanitizeTemporalHtml('<a href="javascript:x">a</a>')).toBe('<a>a</a>');
    expect(sanitizeTemporalHtml('<a href="https://e.org">a</a>')).toContain('href="https://e.org"');
  });
  it('閉じ忘れを閉じ、< をエスケープする', () => {
    expect(sanitizeTemporalHtml('<b>x')).toBe('<b>x</b>');
    expect(sanitizeTemporalHtml('1 < 2')).toBe('1 &lt; 2');
  });
  it('plainText', () => {
    expect(plainText('<p>a</p><p>b &amp; c</p>', true)).toBe('a\nb & c');
  });
});
