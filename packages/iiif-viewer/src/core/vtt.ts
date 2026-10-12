// A small WebVTT reader: the cues (start, end, text) of a caption / transcript file.
// Header, NOTE / STYLE / REGION blocks and cue settings are skipped.

export interface VttCue {
  /** seconds */
  start: number;
  /** seconds */
  end: number;
  text: string;
}

// "hh:mm:ss.mmm" or "mm:ss.mmm" (a comma is accepted for the millisecond separator)
const TIME = /^(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{1,3})$/;

export const parseVttTime = (s: string): number | null => {
  const m = TIME.exec(s.trim());
  if (!m) return null;
  const [, h, min, sec, ms] = m;
  return Number(h ?? 0) * 3600 + Number(min) * 60 + Number(sec) + Number(ms.padEnd(3, '0')) / 1000;
};

const decode = (s: string): string =>
  s
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');

export const parseVtt = (text: string): VttCue[] => {
  const blocks = text
    .replace(/^﻿/, '')
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/);
  const cues: VttCue[] = [];
  for (const block of blocks) {
    const lines = block.split('\n');
    // a cue block: an optional id line, then "start --> end [settings]"
    const at = lines.findIndex((l) => l.includes('-->'));
    if (at < 0 || at > 1) continue; // header, NOTE, STYLE, REGION ...
    if (/^(NOTE|STYLE|REGION)(\s|$)/.test(lines[0])) continue;
    const [a, rest = ''] = lines[at].split('-->');
    const start = parseVttTime(a);
    const end = parseVttTime(rest.trim().split(/\s+/)[0] ?? '');
    if (start === null || end === null) continue;
    const body = decode(lines.slice(at + 1).join('\n')).trim();
    if (!body) continue;
    cues.push({ start, end, text: body });
  }
  return cues;
};
