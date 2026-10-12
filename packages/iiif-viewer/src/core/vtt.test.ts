import { describe, expect, it } from 'vitest';
import { parseVtt, parseVttTime } from './vtt';

describe('parseVttTime', () => {
  it('reads hh:mm:ss.mmm and mm:ss.mmm', () => {
    expect(parseVttTime('01:02:03.500')).toBeCloseTo(3723.5);
    expect(parseVttTime('02:03.250')).toBeCloseTo(123.25);
  });
  it('pads short milliseconds and accepts a comma', () => {
    expect(parseVttTime('00:00:01.5')).toBeCloseTo(1.5);
    expect(parseVttTime('00:00:01,042')).toBeCloseTo(1.042);
  });
  it('returns null for junk', () => {
    expect(parseVttTime('abc')).toBeNull();
  });
});

describe('parseVtt', () => {
  it('skips the header and reads cues with milliseconds', () => {
    const vtt = 'WEBVTT\n\n00:00:01.000 --> 00:00:03.500\nHello\n\n00:00:04.000 --> 00:00:05.250\nWorld\n';
    expect(parseVtt(vtt)).toEqual([
      { start: 1, end: 3.5, text: 'Hello' },
      { start: 4, end: 5.25, text: 'World' },
    ]);
  });
  it('joins multi-line cues, accepts ids and settings, and handles CRLF and BOM', () => {
    const vtt = '﻿WEBVTT - title\r\n\r\ncue-1\r\n00:01.000 --> 00:02.000 align:start position:0%\r\nline one\r\nline two\r\n';
    expect(parseVtt(vtt)).toEqual([{ start: 1, end: 2, text: 'line one\nline two' }]);
  });
  it('ignores NOTE, STYLE and REGION blocks', () => {
    const vtt =
      'WEBVTT\n\nNOTE a comment\nwith two lines\n\nSTYLE\n::cue { color: red }\n\n00:00:01.000 --> 00:00:02.000\nOnly\n';
    expect(parseVtt(vtt)).toEqual([{ start: 1, end: 2, text: 'Only' }]);
  });
  it('strips tags and decodes entities', () => {
    const vtt = 'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n<v Bob>Tom &amp; <i>Jerry</i></v>\n';
    expect(parseVtt(vtt)[0].text).toBe('Tom & Jerry');
  });
  it('returns [] for plain text', () => {
    expect(parseVtt('just a transcript\n\nwith paragraphs')).toEqual([]);
  });
});
