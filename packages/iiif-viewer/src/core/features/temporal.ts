// temporal: 時間のある資料（動画・音声・時刻つきの注釈）の読み取り。React に依存しない。
//
// - 時間の指定: `#t=11,42` / `t=npt:10,20` / FragmentSelector を秒の範囲にする
// - Canvas の上の時間配置: 1 つの Canvas に並ぶ画像・動画・音声・テキストを、いつ・どこに出すかにする
// - 時刻つきのテキスト: 注釈（target が `#t=...` の TextualBody）を文字起こしの一覧にする
// - 字幕・文字起こしのファイル: Choice に入った複数言語の字幕、rendering の文字起こし
//
// containers.ts（共有の読み取り）が拾わないものだけを、manifest の素のデータから読む。

type Json = Record<string, unknown>;

const asList = (v: unknown): unknown[] => (Array.isArray(v) ? v : v == null ? [] : [v]);
const obj = (v: unknown): Json | undefined =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : undefined;
const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);
const num = (v: unknown): number | undefined => {
  const n = Number(v);
  return v != null && v !== '' && Number.isFinite(n) ? n : undefined;
};

// ---------------------------------------------------------------- 時間・領域の指定

export interface TimeRange {
  /** seconds */
  start: number;
  /** seconds. Absent: until the end. */
  end?: number;
}

export interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
}

// "90" / "90.5" / "1:30" / "01:02:03.5" / "npt:90"
const clock = (s: string): number | null => {
  const v = s.trim().replace(/^npt:/, '');
  if (!v) return null;
  const parts = v.split(':');
  if (parts.length > 3) return null;
  let sec = 0;
  for (const p of parts) {
    if (!/^\d+(\.\d+)?$/.test(p)) return null;
    sec = sec * 60 + Number(p);
  }
  return sec;
};

// The part after "#" of a URL, or the whole string when it already is a fragment ("t=1,2").
const fragmentOf = (s: string): string | null => {
  const i = s.indexOf('#');
  if (i >= 0) return s.slice(i + 1);
  return s.includes('=') && !/^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : null;
};

const paramOf = (fragment: string, key: string): string | undefined => {
  for (const part of fragment.split('&')) {
    const eq = part.indexOf('=');
    if (eq > 0 && part.slice(0, eq) === key) return part.slice(eq + 1);
  }
  return undefined;
};

/** "t=11,42" (also "#xywh=...&t=11,42", "t=npt:5", "t=,9") as seconds. null when there is no time. */
export const parseTimeFragment = (input: string): TimeRange | null => {
  const frag = fragmentOf(input);
  const t = frag ? paramOf(frag, 't') : undefined;
  if (t === undefined) return null;
  const [a = '', b = ''] = t.split(',');
  const start = a.trim() === '' ? 0 : clock(a);
  if (start === null) return null;
  if (b.trim() === '') return a.trim() === '' ? null : { start };
  const end = clock(b);
  if (end === null || end <= start) return { start };
  return { start, end };
};

/** "xywh=10,20,30,40" (also "xywh=pixel:10,20,30,40") as a region. Percent regions are not read. */
export const parseRegionFragment = (input: string): Region | null => {
  const frag = fragmentOf(input);
  const v = frag ? paramOf(frag, 'xywh') : undefined;
  if (v === undefined || v.startsWith('percent:')) return null;
  const nums = v.replace(/^pixel:/, '').split(',').map(Number);
  if (nums.length !== 4 || nums.some((n) => !Number.isFinite(n))) return null;
  const [x, y, w, h] = nums;
  return w > 0 && h > 0 ? { x, y, w, h } : null;
};

// Every string that can carry a fragment in a target: the id, the source, FragmentSelectors.
const targetStrings = (target: unknown): string[] => {
  if (typeof target === 'string') return [target];
  const t = obj(target);
  if (!t) return [];
  const out: string[] = [];
  const id = str(t.id);
  if (id) out.push(id);
  const source = t.source;
  if (typeof source === 'string') out.push(source);
  else {
    const sid = str(obj(source)?.id);
    if (sid) out.push(sid);
  }
  for (const sel of asList(t.selector)) {
    const s = obj(sel);
    if (s && (s.type === 'FragmentSelector' || s.type === 'MediaFragmentSelector')) {
      const v = str(s.value);
      if (v) out.push(v);
    }
  }
  return out;
};

/** The time range an annotation target points at (a string target or a SpecificResource). */
export const targetTimeOf = (target: unknown): TimeRange | null => {
  for (const s of targetStrings(target)) {
    const r = parseTimeFragment(s);
    if (r) return r;
  }
  for (const sel of asList(obj(target)?.selector)) {
    const s = obj(sel);
    const instant = s?.type === 'PointSelector' ? num(s.instant) : undefined;
    if (instant !== undefined) return { start: instant };
  }
  return null;
};

/** The spatial part (xywh) of an annotation target, in the canvas's coordinates. */
export const targetRegionOf = (target: unknown): Region | null => {
  for (const s of targetStrings(target)) {
    const r = parseRegionFragment(s);
    if (r) return r;
  }
  return null;
};

// ---------------------------------------------------------------- コンテナ（Canvas / Timeline）

/** The raw container (Canvas / Timeline) of a manifest with this id. */
export const rawContainerOf = (manifest: unknown, id: string): Json | undefined =>
  asList(obj(manifest)?.items)
    .map(obj)
    .find((c): c is Json => !!c && c.id === id);

const annotationsIn = (pages: unknown): Json[] =>
  asList(pages).flatMap((p) => asList(obj(p)?.items).map(obj).filter((a): a is Json => !!a));

const motivationsOf = (anno: Json): unknown[] => asList(anno.motivation);

// ---------------------------------------------------------------- 時間軸の上の配置

export type TimelineKind = 'Image' | 'Video' | 'Audio' | 'Text';

export interface TimelineItem {
  id: string;
  kind: TimelineKind;
  url?: string;
  format?: string;
  label?: unknown;
  /** Text: the value of the TextualBody. */
  text?: string;
  /** Text: the value is HTML (it has to go through sanitizeTemporalHtml before it is shown). */
  isHtml?: boolean;
  /** seconds on the container's timeline */
  start: number;
  end: number;
  /** Whether the manifest gave a time range (otherwise the item lasts the whole timeline). */
  timed: boolean;
  /** Where on the canvas. Absent: the whole canvas. */
  region?: Region;
  /** Video / Audio: where in the media file to start (from "#t=" of its URL). */
  mediaStart: number;
  /** Image: the id of the Image API service, when there is one. */
  service?: string;
  width?: number;
  height?: number;
  /** When the item is one of several options of a Choice: the painting's id and the option's index. */
  choiceId?: string;
  choiceIndex?: number;
}

export interface Timeline {
  duration: number;
  width: number;
  height: number;
  items: TimelineItem[];
  /** The manifest asks to start over at the end (behavior: repeat). */
  repeat: boolean;
}

const bodyKind = (type: unknown): TimelineKind | null => {
  switch (type) {
    case 'Image':
      return 'Image';
    case 'Video':
      return 'Video';
    case 'Audio':
    case 'Sound':
      return 'Audio';
    case 'TextualBody':
      return 'Text';
    default:
      return null;
  }
};

const isMedia = (k: TimelineKind) => k !== 'Text';

const serviceIdOf = (body: Json): string | undefined => {
  for (const s of [...asList(body.service), ...asList(body.services)]) {
    const o = obj(s);
    const id = str(o?.id) ?? str(o?.['@id']);
    const type = str(o?.type) ?? str(o?.['@type']) ?? '';
    if (id && /ImageService/.test(type)) return id.replace(/\/$/, '');
  }
  return undefined;
};

/**
 * The URL to show an image item at about `maxPx` pixels wide. With an Image API
 * service a sized request is used (the body's own URL is often "full/max").
 */
export const timelineImageUrl = (item: TimelineItem, maxPx = 1600): string | undefined => {
  if (item.service) {
    const w = item.width ? Math.min(item.width, maxPx) : maxPx;
    return `${item.service}/full/${Math.round(w)},/0/default.jpg`;
  }
  return item.url;
};

const itemOf = (
  body: Json,
  anno: Json,
  id: string,
  fallbackEnd: number | undefined
): TimelineItem | null => {
  const kind = bodyKind(body.type);
  if (!kind) return null;
  const time = targetTimeOf(anno.target);
  const region = targetRegionOf(anno.target);
  const url = str(body.id);
  const item: TimelineItem = {
    id,
    kind,
    start: time?.start ?? 0,
    end: time?.end ?? fallbackEnd ?? Number.POSITIVE_INFINITY,
    timed: !!time,
    mediaStart: 0,
  };
  if (region) item.region = region;
  if (kind === 'Text') {
    const value = str(body.value);
    if (value === undefined) return null;
    item.text = value;
    item.isHtml = str(body.format) === 'text/html';
    return item;
  }
  if (!url) return null;
  item.url = url;
  const format = str(body.format);
  if (format) item.format = format;
  if (body.label !== undefined) item.label = body.label;
  const mediaTime = parseTimeFragment(url);
  if (mediaTime) item.mediaStart = mediaTime.start;
  const w = num(body.width);
  const h = num(body.height);
  if (w) item.width = w;
  if (h) item.height = h;
  if (kind === 'Image') {
    const service = serviceIdOf(body);
    if (service) item.service = service;
  }
  return item;
};

/**
 * What is painted on a Canvas / Timeline and when: every painting body (Image, Video,
 * Audio, TextualBody) with its time range and region. null when nothing is painted.
 *
 * Painting ids match containers.ts, so a Choice picked in the ChoiceBar
 * (modelChoicesAtom) applies to the items with the same `choiceId`.
 * `manifest` is only read for `behavior: repeat`.
 */
export const timelineOf = (container: unknown, manifest?: unknown): Timeline | null => {
  const c = obj(container);
  if (!c) return null;
  const declared = num(c.duration);
  const raw: TimelineItem[] = [];
  let contents = 0; // painting contents containers.ts would have made so far (its id counter)
  for (const anno of annotationsIn(c.items)) {
    if (!motivationsOf(anno).includes('painting')) continue;
    const bodies = asList(anno.body).map(obj);
    const annoId = String(anno.id ?? `painting-${contents}`);
    bodies.forEach((body, j) => {
      if (!body) return;
      const isChoice = body.type === 'Choice';
      const list = isChoice ? asList(body.items).map(obj) : [body];
      const id = bodies.length > 1 ? `${annoId}#body-${j}` : annoId;
      const made: TimelineItem[] = [];
      list.forEach((b, k) => {
        if (!b) return;
        const item = itemOf(b, anno, isChoice ? `${id}/choice-${k}` : id, declared);
        if (item) made.push(item);
      });
      // containers.ts only counts media bodies; a TextualBody is not one of its paintings
      if (made.some((m) => isMedia(m.kind))) contents += 1;
      made.forEach((m, k) => {
        if (isChoice && isMedia(m.kind)) {
          m.choiceId = id;
          m.choiceIndex = k;
        }
        raw.push(m);
      });
    });
  }
  if (raw.length === 0) return null;

  let duration = declared;
  if (duration === undefined) {
    let max = 0;
    for (const m of raw) if (Number.isFinite(m.end)) max = Math.max(max, m.end);
    if (max === 0) for (const m of raw) max = Math.max(max, m.mediaStart);
    duration = max > 0 ? max : 1;
  }
  const items = raw.map((m) => ({ ...m, end: Number.isFinite(m.end) ? m.end : duration! }));

  let width = num(c.width);
  let height = num(c.height);
  if (!width || !height) {
    // no canvas size: use the extent of what is placed on it, or a 16:9 stage
    let maxX = 0;
    let maxY = 0;
    for (const m of items) {
      if (m.region) {
        maxX = Math.max(maxX, m.region.x + m.region.w);
        maxY = Math.max(maxY, m.region.y + m.region.h);
      }
    }
    width = maxX || 1600;
    height = maxY || 900;
  }
  return {
    duration,
    width,
    height,
    items,
    repeat: [...asList(c.behavior), ...asList(obj(manifest)?.behavior)].includes('repeat'),
  };
};

/** The items visible at a time (start <= t < end; the last instant belongs to the last items). */
export const activeItemsAt = (timeline: Timeline, t: number): TimelineItem[] =>
  timeline.items.filter(
    (m) => m.start <= t && (t < m.end || (m.end >= timeline.duration && t <= timeline.duration))
  );

/** The time of an item's media for a time on the timeline (never negative). */
export const mediaTimeAt = (item: TimelineItem, t: number): number =>
  Math.max(0, t - item.start) + item.mediaStart;

/**
 * Whether the container needs the composite display: several things are painted on it
 * and either the manifest times them or one of them is a video / audio.
 */
export const isComposite = (timeline: Timeline | null): boolean => {
  if (!timeline) return false;
  const media = timeline.items.filter((m) => isMedia(m.kind));
  const slots = new Set(media.map((m) => m.choiceId ?? m.id));
  if (slots.size + (timeline.items.length - media.length) < 2) return false;
  return (
    timeline.items.some((m) => m.timed) || media.some((m) => m.kind === 'Video' || m.kind === 'Audio')
  );
};

// ---------------------------------------------------------------- HTML（TextualBody）

const ALLOWED_TAGS = new Set([
  'p', 'div', 'span', 'br', 'b', 'strong', 'i', 'em', 'u', 'small', 'sub', 'sup',
  'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'a',
]);
const VOID_TAGS = new Set(['br']);

const escapeText = (s: string) => s.replace(/&(?!(?:[a-z]+|#\d+|#x[0-9a-f]+);)/gi, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Only a few presentational properties, with plain values.
const STYLE_PROPS = new Set(['font-size', 'font-weight', 'font-style', 'color', 'text-align', 'line-height']);
const cleanStyle = (style: string): string =>
  style
    .split(';')
    .map((d) => d.split(':'))
    .filter(([k, v]) => k && v && STYLE_PROPS.has(k.trim().toLowerCase()) && /^[\w\s#.%,()-]+$/.test(v) && !/url|expression/i.test(v))
    .map(([k, v]) => `${k.trim().toLowerCase()}:${v.trim()}`)
    .join(';');

const cleanAttrs = (tag: string, rawAttrs: string): string => {
  let out = '';
  const re = /([a-zA-Z-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(rawAttrs))) {
    const name = m[1].toLowerCase();
    const value = m[2] ?? m[3] ?? '';
    if (name === 'style') {
      const s = cleanStyle(value);
      if (s) out += ` style="${s}"`;
    } else if (name === 'lang' && /^[\w-]{1,20}$/.test(value)) {
      out += ` lang="${value}"`;
    } else if (tag === 'a' && name === 'href' && /^https?:\/\//i.test(value.trim())) {
      out += ` href="${value.trim().replace(/"/g, '&quot;')}" target="_blank" rel="noopener noreferrer"`;
    }
  }
  return out;
};

/** A small allow-list HTML cleaner for TextualBody values (no scripts, no event handlers, no images). */
export const sanitizeTemporalHtml = (html: string): string => {
  const open: string[] = [];
  let out = '';
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*)>|<!--[\s\S]*?-->|([^<]+|<)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (m[4] !== undefined) {
      out += escapeText(m[4]);
      continue;
    }
    if (m[2] === undefined) continue; // comment
    const tag = m[2].toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) continue; // drop the tag, keep its text
    if (m[1]) {
      const at = open.lastIndexOf(tag);
      if (at >= 0) {
        while (open.length > at) out += `</${open.pop()}>`;
      }
    } else {
      out += `<${tag}${cleanAttrs(tag, m[3])}>`;
      if (!VOID_TAGS.has(tag)) open.push(tag);
    }
  }
  while (open.length) out += `</${open.pop()}>`;
  return out;
};

const ENTITIES: Record<string, string> = { '&lt;': '<', '&gt;': '>', '&nbsp;': ' ', '&quot;': '"', '&#39;': "'", '&amp;': '&' };

/** The text of a TextualBody value (HTML tags removed). */
export const plainText = (value: string, isHtml = false): string => {
  if (!isHtml && !/<[a-z/][^>]*>/i.test(value)) return value.trim();
  return value
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|blockquote)>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&(?:lt|gt|nbsp|quot|#39|amp);/g, (e) => ENTITIES[e] ?? e)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

// ---------------------------------------------------------------- 時刻つきの注釈（文字起こし）

export interface TimedText {
  id: string;
  /** seconds */
  start: number;
  /** seconds; the next one's start (or the duration) when the target gives none */
  end: number;
  text: string;
  /** the AnnotationPage's label, when it has one (e.g. "Environmental Noise") */
  group?: unknown;
  /** the Annotation's `provides` ("closedCaptions", "subtitles", ...) */
  provides: string[];
  /** BCP 47 code of the first body that has one */
  language?: string;
}

/**
 * Annotations whose body is text and whose target has a time ("#t=702,705"), in time
 * order. Painting Annotations are not included (they are shown on the canvas).
 */
export const timedTextsOf = (container: unknown): TimedText[] => {
  const c = obj(container);
  if (!c) return [];
  const out: TimedText[] = [];
  const pages = [...asList(c.annotations), ...asList(c.items)];
  for (const raw of pages) {
    const page = obj(raw);
    for (const anno of asList(page?.items).map(obj)) {
      if (!anno || motivationsOf(anno).includes('painting')) continue;
      const time = targetTimeOf(anno.target);
      if (!time) continue;
      const values = asList(anno.body)
        .map(obj)
        .filter((b): b is Json => !!b && b.type === 'TextualBody')
        .map((b) => plainText(str(b.value) ?? '', str(b.format) === 'text/html'))
        .filter(Boolean);
      const bodyValue = str(anno.bodyValue);
      if (bodyValue) values.push(bodyValue);
      if (values.length === 0) continue;
      const language = asList(anno.body)
        .flatMap((b) => asList(obj(b)?.language))
        .find((l): l is string => typeof l === 'string');
      out.push({
        id: String(anno.id ?? `timed-${out.length}`),
        start: time.start,
        end: time.end ?? Number.NaN,
        text: values.join('\n'),
        ...(page?.label !== undefined ? { group: page.label } : {}),
        provides: asList(anno.provides).filter((p): p is string => typeof p === 'string'),
        ...(language ? { language } : {}),
      });
    }
  }
  out.sort((a, b) => a.start - b.start);
  const duration = num(c.duration);
  return out.map((t, i) => ({
    ...t,
    end: Number.isFinite(t.end) ? t.end : (out[i + 1]?.start ?? duration ?? t.start + 5),
  }));
};

// ---------------------------------------------------------------- 注釈で書かれた字幕（0079）

/** `<track kind>`: "subtitles" only when the Annotation says so and not closedCaptions too. */
export type CaptionKind = 'captions' | 'subtitles';

export const captionKindOf = (provides: string[]): CaptionKind =>
  provides.includes('subtitles') && !provides.includes('closedCaptions') ? 'subtitles' : 'captions';

export interface TimedCaptions {
  language?: string;
  kind: CaptionKind;
  cues: TimedText[];
}

/**
 * Timed TextualBody annotations that provide closedCaptions or subtitles (recipe 0079),
 * one set per language and kind, so that each can be given to the player as a track.
 */
export const timedCaptionsOf = (container: unknown): TimedCaptions[] => {
  const groups = new Map<string, TimedCaptions>();
  for (const cue of timedTextsOf(container)) {
    if (!cue.provides.some((p) => p === 'closedCaptions' || p === 'subtitles')) continue;
    const kind = captionKindOf(cue.provides);
    const key = `${cue.language ?? ''}|${kind}`;
    let g = groups.get(key);
    if (!g) {
      g = { ...(cue.language ? { language: cue.language } : {}), kind, cues: [] };
      groups.set(key, g);
    }
    g.cues.push(cue);
  }
  return [...groups.values()];
};

const vttTime = (seconds: number): string => {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${pad(Math.floor(ms / 3_600_000))}:${pad(Math.floor(ms / 60_000) % 60)}:${pad(Math.floor(ms / 1000) % 60)}.${pad(ms % 1000, 3)}`;
};

/** A WebVTT file of the cues. "-->" and blank lines in the text would end a cue, so they are escaped. */
export const toWebVtt = (cues: TimedText[]): string =>
  [
    'WEBVTT',
    ...cues.map((c) => {
      const text = c.text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/-->/g, '--&gt;')
        .replace(/\n\s*\n/g, '\n');
      return `${vttTime(c.start)} --> ${vttTime(c.end)}\n${text}`;
    }),
  ].join('\n\n') + '\n';

// ---------------------------------------------------------------- 字幕・文字起こしのファイル

export interface CaptionFile {
  url: string;
  format?: string;
  /** BCP 47 code */
  language?: string;
  label?: unknown;
  provides: string[];
  kind: CaptionKind;
}

const isVttBody = (b: Json): boolean => {
  const url = str(b.id) ?? '';
  return b.format === 'text/vtt' || /\.vtt(\?|$)/i.test(url);
};

/**
 * The WebVTT files supplementing a container, including those inside a Choice (one
 * body per language, recipe 0074). containers.ts reads only plain bodies.
 */
export const captionFilesOf = (container: unknown): CaptionFile[] => {
  const c = obj(container);
  if (!c) return [];
  const out: CaptionFile[] = [];
  for (const anno of [...annotationsIn(c.annotations), ...annotationsIn(c.items)]) {
    if (!motivationsOf(anno).includes('supplementing')) continue;
    const provides = asList(anno.provides).filter((p): p is string => typeof p === 'string');
    if (provides.includes('transcript') && !provides.includes('closedCaptions')) continue;
    for (const raw of asList(anno.body)) {
      const body = obj(raw);
      if (!body) continue;
      const bodies = body.type === 'Choice' ? asList(body.items).map(obj) : [body];
      for (const b of bodies) {
        const url = str(b?.id);
        if (!b || !url || !isVttBody(b)) continue;
        const language = asList(b.language).find((l): l is string => typeof l === 'string');
        out.push({
          url,
          format: str(b.format) ?? 'text/vtt',
          ...(language ? { language } : {}),
          ...(b.label !== undefined ? { label: b.label } : {}),
          provides,
          kind: captionKindOf(provides),
        });
      }
    }
  }
  return out;
};

export interface RenderingTranscript {
  url: string;
  format?: string;
  label?: unknown;
}

/** A text file given as `rendering` of the container (recipe 0017's "Transcript"). */
export const renderingTranscriptOf = (container: unknown): RenderingTranscript | undefined => {
  for (const raw of asList(obj(container)?.rendering)) {
    const r = obj(raw);
    const url = str(r?.id);
    if (!r || !url) continue;
    const format = str(r.format);
    const textual = r.type === 'Text' || format === 'text/plain' || format === 'text/vtt';
    if (textual && (!format || format === 'text/plain' || format === 'text/vtt')) {
      return { url, ...(format ? { format } : {}), ...(r.label !== undefined ? { label: r.label } : {}) };
    }
  }
  return undefined;
};
