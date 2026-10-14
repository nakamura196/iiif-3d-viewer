// annotationStyle: 注釈の見た目の指定（Recipe 0045: stylesheet / styleClass）を安全に読む。React・DOM に依存しない。
//
// マニフェストは信頼できない入力なので、CSS をそのままページに入れない。
// CSS を自前で読み、許可した少数の性質（下の ALLOWED_PROPERTIES）と値の形だけを残す。
// 結果は「クラス名 → 宣言」の表で、React 側は該当する注釈の要素の style にだけ当てる。
// 性質を足すときは ALLOWED_PROPERTIES に 1 行足す（ここだけ）。

/** 宣言。キーは React の style でそのまま使える camelCase。 */
export type StyleDeclarations = Record<string, string>;
/** クラス名（ドット無し）→ 宣言 */
export type StyleRules = Record<string, StyleDeclarations>;

const NAMED_COLOR = /^[a-z]{3,30}$/i;
const HEX_COLOR = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const FUNC_COLOR = /^(?:rgb|rgba|hsl|hsla)\(\s*[-+0-9.%]+(?:\s*[, /]\s*[-+0-9.%]+(?:deg)?){2,3}\s*\)$/i;
const LENGTH = /^(\d{1,3}(?:\.\d{1,3})?)(px|em|rem|%)?$/;
const BORDER_STYLES = new Set(['none', 'solid', 'dashed', 'dotted', 'double']);
const DECORATION_WORDS = new Set([
  'none', 'underline', 'overline', 'line-through', 'solid', 'double', 'dotted', 'dashed', 'wavy',
]);
const MAX_BORDER_WIDTH_PX = 20;

const isColor = (v: string): boolean => HEX_COLOR.test(v) || FUNC_COLOR.test(v) || NAMED_COLOR.test(v);

const isBorderWidth = (v: string): boolean => {
  if (/^(thin|medium|thick)$/i.test(v)) return true;
  const m = /^(\d{1,2}(?:\.\d{1,2})?)(px|em|rem)?$/.exec(v);
  if (!m) return false;
  const n = parseFloat(m[1]);
  return m[2] === 'px' || !m[2] ? n <= MAX_BORDER_WIDTH_PX : n <= 2;
};

// 空白で区切った語を 1 つずつ見る（border のまとめ書き用）
const tokens = (v: string): string[] => v.split(/\s+(?![^(]*\))/).filter(Boolean);

type Check = (value: string) => boolean;

/** 許可する性質。キーは CSS の名前、値は検査（true で採用）。 */
export const ALLOWED_PROPERTIES: Record<string, Check> = {
  color: isColor,
  'background-color': isColor,
  'border-color': isColor,
  'border-style': (v) => BORDER_STYLES.has(v.toLowerCase()),
  'border-width': isBorderWidth,
  border: (v) => {
    const t = tokens(v);
    return (
      t.length >= 1 &&
      t.length <= 3 &&
      t.every((x) => isBorderWidth(x) || BORDER_STYLES.has(x.toLowerCase()) || isColor(x))
    );
  },
  'border-radius': (v) => {
    const m = LENGTH.exec(v);
    return !!m && parseFloat(m[1]) <= 50;
  },
  'font-weight': (v) => /^(normal|bold|bolder|lighter|[1-9]00)$/i.test(v),
  'font-style': (v) => /^(normal|italic|oblique)$/i.test(v),
  'text-decoration': (v) => {
    const t = tokens(v);
    return t.length >= 1 && t.length <= 4 && t.every((x) => DECORATION_WORDS.has(x.toLowerCase()) || isColor(x));
  },
  opacity: (v) => {
    const n = Number(v);
    return /^[0-9.]+$/.test(v) && Number.isFinite(n) && n >= 0 && n <= 1;
  },
};

// 値に出てきたら即却下する書き方（上の形の検査をすり抜けた場合の保険）
const FORBIDDEN = /url\s*\(|expression|@import|javascript|vbscript|behaviou?r|-moz-binding|image-set|var\s*\(|attr\s*\(|env\s*\(|calc\s*\(|[\\<>{}"';]|\/\*|!important/i;

/** 1 つの宣言を検査して、採用なら [React のキー, 値] を返す。 */
export const sanitizeDeclaration = (property: string, value: string): [string, string] | null => {
  const prop = property.trim().toLowerCase();
  const val = value.trim().replace(/\s+/g, ' ');
  const check = ALLOWED_PROPERTIES[prop];
  if (!check || !val || val.length > 100 || FORBIDDEN.test(val) || !check(val)) return null;
  // opacity 0 だと注釈が見えなくなるので下限を設ける
  const out = prop === 'opacity' ? String(Math.max(0.1, Number(val))) : val;
  return [prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()), out];
};

const MAX_CSS_LENGTH = 100_000;
const MAX_RULES = 200;
const CLASS_NAME = /^[A-Za-z_][A-Za-z0-9_-]{0,63}$/;

/** styleClass の値（空白区切り）からクラス名を取り出す。不正な名前は捨てる。 */
export const parseStyleClasses = (value: unknown): string[] =>
  typeof value === 'string' ? value.split(/\s+/).filter((c) => CLASS_NAME.test(c)).slice(0, 10) : [];

/**
 * CSS の文字列を読む。使うのは `.クラス名 { 性質: 値; }` の形だけ。
 * 要素・ID・属性・疑似クラス・子孫などの選択子、@ から始まる規則は読み飛ばす。
 */
export const parseAnnotationCss = (css: unknown): StyleRules => {
  if (typeof css !== 'string' || css.length > MAX_CSS_LENGTH) return {};
  const rules: StyleRules = Object.create(null);
  const text = css
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/@[^{};]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, ' ') // @media など、中身ごと捨てる
    .replace(/@[^{};]*;/g, ' '); // @import など
  let count = 0;
  for (const m of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (++count > MAX_RULES) break;
    const selectors = m[1].split(',').map((s) => s.trim());
    const decls: StyleDeclarations = {};
    for (const d of m[2].split(';')) {
      const i = d.indexOf(':');
      if (i < 0) continue;
      const ok = sanitizeDeclaration(d.slice(0, i), d.slice(i + 1));
      if (ok) decls[ok[0]] = ok[1];
    }
    if (Object.keys(decls).length === 0) continue;
    for (const sel of selectors) {
      const c = /^\.([A-Za-z_][A-Za-z0-9_-]{0,63})$/.exec(sel);
      if (c) rules[c[1]] = { ...rules[c[1]], ...decls };
    }
  }
  return { ...rules };
};

/** 指定されたクラスの宣言を、後に書いたクラスを優先して重ねる。 */
export const resolveStyle = (rules: StyleRules | undefined, classes: string[] | undefined): StyleDeclarations => {
  const out: StyleDeclarations = {};
  if (!rules || !classes) return out;
  for (const c of classes) if (Object.prototype.hasOwnProperty.call(rules, c)) Object.assign(out, rules[c]);
  return out;
};

export interface AnnotationStyleSource {
  /** 注釈に書かれた CssStylesheet の中身（読み済み） */
  styleRules?: StyleRules;
  /** 別ファイルの stylesheet の URL */
  stylesheetUrl?: string;
  /** 領域（target）の styleClass */
  targetClasses?: string[];
  /** 本文（body）の styleClass */
  bodyClasses?: string[];
}

export interface AnnotationStyles {
  /** 画像の上の領域に当てる */
  target: StyleDeclarations;
  /** 右パネルの本文に当てる */
  body: StyleDeclarations;
}

/** 注釈の見た目。外部 stylesheet は `external`（URL → 読み済みの規則）に入っていれば使う。 */
export const annotationStyles = (
  anno: AnnotationStyleSource,
  external?: Record<string, StyleRules | undefined>,
): AnnotationStyles => {
  const rules: StyleRules = {
    ...(anno.stylesheetUrl ? external?.[anno.stylesheetUrl] : undefined),
    ...anno.styleRules,
  };
  return { target: resolveStyle(rules, anno.targetClasses), body: resolveStyle(rules, anno.bodyClasses) };
};

/** `stylesheet` の値（URL の文字列、CssStylesheet、またはその並び）を、中身と URL に分ける。 */
export const readStylesheetField = (value: unknown): { styleRules?: StyleRules; stylesheetUrl?: string } => {
  let styleRules: StyleRules | undefined;
  let stylesheetUrl: string | undefined;
  const list = Array.isArray(value) ? value : value == null ? [] : [value];
  for (const v of list) {
    if (typeof v === 'string') {
      if (/^https?:\/\//i.test(v)) stylesheetUrl ??= v;
    } else if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      if (typeof o.value === 'string') styleRules = { ...styleRules, ...parseAnnotationCss(o.value) };
      else {
        const id = typeof o.id === 'string' ? o.id : typeof o['@id'] === 'string' ? (o['@id'] as string) : undefined;
        if (id && /^https?:\/\//i.test(id)) stylesheetUrl ??= id;
      }
    }
  }
  return { ...(styleRules ? { styleRules } : {}), ...(stylesheetUrl ? { stylesheetUrl } : {}) };
};
