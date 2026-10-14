import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { convertToV4 } from '../services/manifestConverter';
import {
  ALLOWED_PROPERTIES,
  annotationStyles,
  parseAnnotationCss,
  parseStyleClasses,
  readStylesheetField,
  resolveStyle,
  sanitizeDeclaration,
} from './annotationStyle';
import { embeddedCanvasAnnotations } from './annotations';

const dir = join(__dirname, '__fixtures__/annotations');
const css = readFileSync(join(dir, '0045-style.css'), 'utf8');
const manifest = convertToV4(JSON.parse(readFileSync(join(dir, '0045-annotation-styling.json'), 'utf8')));

describe('Recipe 0045', () => {
  const canvas = manifest.items[0] as unknown as { id: string; width: number; height: number };
  const annos = embeddedCanvasAnnotations(manifest, canvas.id, canvas).filter((a) => a.motivations.includes('commenting'));

  it('stylesheet の URL と styleClass を読む', () => {
    expect(annos).toHaveLength(2);
    expect(annos[0].stylesheetUrl).toMatch(/style\.css$/);
    expect(annos[0].bodyClasses).toEqual(['author1note']);
    expect(annos[0].targetClasses).toEqual(['author2highlight']);
    expect(annos[1].bodyClasses).toEqual(['author2note']);
  });

  it('レシピの CSS から、クラスごとの宣言を作る', () => {
    const rules = parseAnnotationCss(css);
    expect(rules.author1note).toEqual({ color: '#f00', backgroundColor: '#fff', borderColor: '#f00' });
    expect(rules.author2note).toEqual({ color: '#1a1', backgroundColor: '#fff', borderColor: '#0f0' });
  });

  it('外部 stylesheet が取れたら本文と領域に反映する', () => {
    const rules = parseAnnotationCss(css + '.author2highlight { color: blue; border-color: blue; }');
    const st = annotationStyles(annos[0], { [annos[0].stylesheetUrl!]: rules });
    expect(st.body.color).toBe('#f00');
    expect(st.target.borderColor).toBe('blue');
    // 取れていないあいだは指定なし
    expect(annotationStyles(annos[0], {})).toEqual({ target: {}, body: {} });
  });
});

describe('インラインの CssStylesheet', () => {
  it('value を読む', () => {
    const f = readStylesheetField({ type: 'CssStylesheet', value: '.a { color: red; }' });
    expect(f.styleRules).toEqual({ a: { color: 'red' } });
    expect(readStylesheetField([{ id: 'https://example.org/s.css', type: 'CssStylesheet' }]).stylesheetUrl).toBe(
      'https://example.org/s.css',
    );
  });
  it('http(s) 以外の URL は読まない', () => {
    expect(readStylesheetField('javascript:alert(1)')).toEqual({});
    expect(readStylesheetField('data:text/css,.a{color:red}')).toEqual({});
  });
});

describe('危険な入力', () => {
  const bad = [
    'background-color: url(https://evil.example/x.png)',
    'color: expression(alert(1))',
    'color: red; background: url(x)',
    'background-image: url(x)',
    'position: fixed',
    'width: 100vw',
    'z-index: 9999',
    'content: "x"',
    'pointer-events: none',
    'color: red !important',
    'color: var(--x)',
    'border-width: 500px',
    'opacity: 2',
    'font-weight: expression(1)',
    'color: \\75rl(x)',
  ];
  it.each(bad)('落とす: %s', (decl) => {
    const rules = parseAnnotationCss(`.a { ${decl} }`);
    expect(rules.a === undefined || Object.keys(rules.a).every((k) => k === 'color' && !/!|var|\\/.test(decl))).toBe(true);
    const out = JSON.stringify(rules);
    expect(out).not.toMatch(/url|expression|fixed|vw|9999|var\(|!important|500px/);
  });

  it('@import・@media・要素/ID/子孫/疑似クラスの選択子は読まない', () => {
    const rules = parseAnnotationCss(`
      @import url(https://evil.example/a.css);
      @media (min-width:1px) { .m { color: red; } }
      body { color: red; }
      #id { color: red; }
      .a .b { color: red; }
      .a:hover { color: red; }
      div.a { color: red; }
      .ok, body { color: green; }
    `);
    expect(Object.keys(rules)).toEqual(['ok']);
  });

  it('値の中の閉じ括弧や記号で別の宣言をねじ込めない', () => {
    expect(sanitizeDeclaration('color', 'red; position: fixed')).toBeNull();
    expect(sanitizeDeclaration('color', 'red}body{color:red')).toBeNull();
    expect(sanitizeDeclaration('color', '</style><script>')).toBeNull();
  });

  it('opacity 0 は下限に直す', () => {
    expect(sanitizeDeclaration('opacity', '0')).toEqual(['opacity', '0.1']);
  });

  it('大きすぎる CSS・文字列以外は空', () => {
    expect(parseAnnotationCss('x'.repeat(200_000))).toEqual({});
    expect(parseAnnotationCss({ a: 1 })).toEqual({});
  });

  it('クラス名: __proto__ などは効かない', () => {
    expect(parseStyleClasses('a __proto__ b<c ok-1')).toEqual(['a', '__proto__', 'ok-1']);
    const rules = parseAnnotationCss('.__proto__ { color: red; }');
    expect(resolveStyle(rules, ['__proto__'])).toEqual({ color: 'red' });
    expect(({} as Record<string, unknown>).color).toBeUndefined();
    expect(resolveStyle({}, ['constructor', 'toString'])).toEqual({});
  });
});

describe('許可する性質', () => {
  it.each([
    ['color', '#f00'], ['color', 'rgba(0, 0, 0, 0.5)'], ['background-color', 'transparent'],
    ['border', '2px solid #00f'], ['border-style', 'dashed'], ['font-weight', 'bold'],
    ['font-style', 'italic'], ['text-decoration', 'underline wavy'], ['opacity', '0.5'],
  ])('%s: %s', (p, v) => {
    expect(sanitizeDeclaration(p, v)).not.toBeNull();
  });
  it('許可一覧は ALLOWED_PROPERTIES の 1 か所', () => {
    expect(Object.keys(ALLOWED_PROPERTIES)).toContain('border-color');
  });
});
