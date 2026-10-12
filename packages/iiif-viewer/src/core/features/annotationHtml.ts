// 注釈の本文（HTML）を安全な HTML にする。DOM に依存しない（許可リスト方式）。
// 許可するタグ・属性だけを残し、script・イベント属性・javascript: などは落とす。

const DROP_WITH_CONTENT = new Set([
  'script', 'style', 'iframe', 'object', 'embed', 'noscript', 'template', 'svg', 'math',
  'form', 'textarea', 'select', 'option', 'button', 'title', 'head', 'meta', 'link', 'base',
  'frame', 'frameset', 'applet', 'audio', 'video', 'canvas',
]);

const ALLOWED_TAGS = new Set([
  'a', 'abbr', 'b', 'blockquote', 'br', 'cite', 'code', 'dd', 'del', 'div', 'dl', 'dt', 'em',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'img', 'ins', 'li', 'mark', 'ol', 'p', 'pre',
  'q', 's', 'small', 'span', 'strong', 'sub', 'sup', 'table', 'tbody', 'td', 'tfoot', 'th',
  'thead', 'tr', 'u', 'ul',
]);

const VOID_TAGS = new Set(['br', 'hr', 'img']);

const ALLOWED_ATTRS: Record<string, string[]> = {
  a: ['href', 'title', 'hreflang'],
  img: ['src', 'alt', 'title', 'width', 'height'],
  td: ['colspan', 'rowspan'],
  th: ['colspan', 'rowspan'],
  q: ['cite'],
  blockquote: ['cite'],
};
const GLOBAL_ATTRS = ['lang', 'dir', 'title'];

const ENTITY: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

const decodeEntities = (s: string): string =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : '';
    }
    return ENTITY[e.toLowerCase()] ?? m;
  });

const escapeAttr = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const escapeText = (s: string): string =>
  s.replace(/&(?!#?[a-z0-9]+;)/gi, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// http / https / mailto だけを通す。相対 URL と、制御文字・空白を挟んだ偽装は通さない。
export const safeAnnotationUrl = (raw: string): string | null => {
  const url = decodeEntities(raw).replace(/[\u0000- \u007f-\u009f]/g, '');
  if (!url) return null;
  return /^(https?:\/\/|mailto:)/i.test(url) ? decodeEntities(raw).trim() : null;
};

const ATTR_RE = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

const attrsOf = (tag: string, raw: string): string => {
  const allowed = new Set([...(ALLOWED_ATTRS[tag] ?? []), ...GLOBAL_ATTRS]);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const m of raw.matchAll(ATTR_RE)) {
    const name = m[1].toLowerCase();
    if (!allowed.has(name) || seen.has(name)) continue;
    const value = m[2] ?? m[3] ?? m[4] ?? '';
    if (name === 'href' || name === 'src' || name === 'cite') {
      const url = safeAnnotationUrl(value);
      if (!url) continue;
      seen.add(name);
      out.push(`${name}="${escapeAttr(url)}"`);
      continue;
    }
    seen.add(name);
    out.push(`${name}="${escapeAttr(decodeEntities(value))}"`);
  }
  if (tag === 'a') out.push('target="_blank"', 'rel="noopener noreferrer nofollow"');
  if (tag === 'img') out.push('loading="lazy"', 'referrerpolicy="no-referrer"');
  return out.length ? ` ${out.join(' ')}` : '';
};

const TOKEN_RE = /<!--[\s\S]*?(?:-->|$)|<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^'">])*)>|<[^>]*>|[^<]+|</g;

export const sanitizeAnnotationHtml = (html: string): string => {
  let out = '';
  const stack: string[] = [];
  let dropping: string | null = null;
  for (const m of html.matchAll(TOKEN_RE)) {
    const token = m[0];
    const tag = m[2]?.toLowerCase();
    if (!tag) {
      // text, comment, or a malformed tag
      if (dropping || token.startsWith('<')) continue;
      out += escapeText(token);
      continue;
    }
    const closing = m[1] === '/';
    if (dropping) {
      if (closing && tag === dropping) dropping = null;
      continue;
    }
    if (DROP_WITH_CONTENT.has(tag)) {
      if (!closing && !token.endsWith('/>')) dropping = tag;
      continue;
    }
    if (!ALLOWED_TAGS.has(tag)) continue; // unknown tag: drop the tag, keep its children
    if (closing) {
      const at = stack.lastIndexOf(tag);
      if (at < 0) continue;
      while (stack.length > at) out += `</${stack.pop()}>`;
      continue;
    }
    out += `<${tag}${attrsOf(tag, m[3] ?? '')}>`;
    if (!VOID_TAGS.has(tag)) stack.push(tag);
  }
  while (stack.length) out += `</${stack.pop()}>`;
  return out;
};
