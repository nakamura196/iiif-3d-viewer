import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { convertToV4 } from '../services/manifestConverter';
import { aboutHasContent, aboutOf, htmlToText, safeAboutUrl, sanitizeAboutHtml, valuesIn } from './about';

const load = (name: string) =>
  convertToV4(JSON.parse(readFileSync(new URL(`./__fixtures__/about/${name}.json`, import.meta.url), 'utf8')));

const aboutFor = (name: string, locale = 'en', canvas?: string) => {
  const m = load(name);
  const id = canvas ?? (m.items?.[0] as { id?: string } | undefined)?.id;
  return aboutOf(m, id, locale)!;
};

describe('sanitizeAboutHtml', () => {
  it('keeps the HTML subset that Presentation 3 allows', () => {
    const html = '<p>Picture by <a href="https://example.org/x">Glen</a><br/><b>bold</b> <i>it</i></p>';
    expect(sanitizeAboutHtml(html)).toBe(
      '<p>Picture by <a href="https://example.org/x" target="_blank" rel="noopener noreferrer">Glen</a><br><b>bold</b> <i>it</i></p>',
    );
  });

  it('removes script elements with their content', () => {
    expect(sanitizeAboutHtml('a<script>alert(1)</script>b')).toBe('ab');
    expect(sanitizeAboutHtml('a<SCRIPT src="x.js"></SCRIPT>b')).toBe('ab');
    expect(sanitizeAboutHtml('<style>body{display:none}</style>ok')).toBe('ok');
    expect(sanitizeAboutHtml('<iframe src="https://evil"></iframe>ok')).toBe('ok');
  });

  it('removes event handler attributes', () => {
    const out = sanitizeAboutHtml('<img src="https://example.org/a.png" onerror="alert(1)" onload=alert(2)>');
    expect(out).toBe('<img src="https://example.org/a.png">');
    expect(sanitizeAboutHtml('<span onclick="x()" style="color:red" class="c">t</span>')).toBe('<span>t</span>');
    expect(sanitizeAboutHtml('<a href="https://e.org" onmouseover="x()">t</a>')).not.toMatch(/onmouseover/);
  });

  it('removes javascript: and other unsafe URLs, even when hidden', () => {
    for (const bad of [
      'javascript:alert(1)',
      'JaVaScRiPt:alert(1)',
      ' javascript:alert(1)',
      'java\tscript:alert(1)',
      '&#106;avascript:alert(1)',
      'jav&#x61;script:alert(1)',
      'data:text/html;base64,PHNjcmlwdD4=',
      'vbscript:msgbox(1)',
    ]) {
      const out = sanitizeAboutHtml(`<a href="${bad}">x</a>`);
      expect(out, bad).not.toMatch(/href/i);
      expect(out, bad).not.toMatch(/javascript/i);
      expect(sanitizeAboutHtml(`<img src="${bad}">`), bad).toBe('<img>');
    }
  });

  it('does not let a quote or > inside an attribute break out of the tag', () => {
    const out = sanitizeAboutHtml('<a href="https://e.org/?q=\'><script>alert(1)</script>">x</a>');
    expect(out).not.toMatch(/<script/i);
    const out2 = sanitizeAboutHtml('<a title="a>b" href="https://e.org">x</a>');
    expect(out2).toBe('<a href="https://e.org" target="_blank" rel="noopener noreferrer">x</a>');
    expect(sanitizeAboutHtml('<a href="https://e.org/&quot; onclick=&quot;x()">x</a>')).not.toMatch(/ onclick=/);
  });

  it('turns unknown tags into their text and escapes stray < and &', () => {
    expect(sanitizeAboutHtml('<div><h1>a</h1></div>')).toBe('a');
    expect(sanitizeAboutHtml('1 < 2 & 3 > 2')).toBe('1 &lt; 2 &amp; 3 &gt; 2');
    expect(sanitizeAboutHtml('&lt;script&gt; &amp; &#169;')).toBe('&lt;script&gt; &amp; &#169;');
    expect(sanitizeAboutHtml('<!-- <script>x</script> -->t')).toBe('t');
  });

  it('closes open tags and ignores stray closing tags', () => {
    expect(sanitizeAboutHtml('<b>a</i>c')).toBe('<b>ac</b>');
  });

  it('handles non-string input', () => {
    expect(sanitizeAboutHtml(undefined)).toBe('');
    expect(sanitizeAboutHtml(42)).toBe('');
  });

  it('htmlToText', () => {
    expect(htmlToText('<span>A &amp; <b>B</b></span><script>x</script>')).toBe('A & B');
  });

  it('safeAboutUrl', () => {
    expect(safeAboutUrl('https://example.org/a')).toBe('https://example.org/a');
    expect(safeAboutUrl('mailto:a@example.org')).toBe('mailto:a@example.org');
    expect(safeAboutUrl('/relative/path')).toBe('/relative/path');
    expect(safeAboutUrl('javascript:alert(1)')).toBe('');
  });
});

describe('valuesIn', () => {
  it('picks the locale, then none, then en, then any', () => {
    expect(valuesIn({ en: ['a'], fr: ['b'] }, 'fr')).toEqual(['b']);
    expect(valuesIn({ none: ['x'], en: ['a'] }, 'ja')).toEqual(['x']);
    expect(valuesIn({ fr: ['b'], en: ['a'] }, 'ja')).toEqual(['a']);
    expect(valuesIn({ fr: ['b'] }, 'ja')).toEqual(['b']);
  });
  it('keeps every value of one language', () => {
    expect(valuesIn({ en: ['p', 'q'] }, 'en')).toEqual(['p', 'q']);
  });
  it('reads Presentation 2 strings', () => {
    expect(valuesIn([{ '@value': 'Hi', '@language': 'en' }], 'en')).toEqual(['Hi']);
    expect(valuesIn('plain', 'en')).toEqual(['plain']);
  });
});

describe('cookbook: language and values', () => {
  it('0006 text-language: label and metadata in the reader language', () => {
    const fr = aboutFor('0006-text-language', 'fr').manifest;
    expect(fr.label).toBe('La Mère de Whistler');
    expect(fr.metadata.map((m) => m.label)).toEqual(['Auteur', 'Sujet']);
    expect(fr.metadata[0].values).toEqual(['Whistler, James Abbott McNeill']);
    expect(fr.metadata[1].values[0]).toMatch(/mère de Whistler/);
    const ja = aboutFor('0006-text-language', 'ja').manifest;
    expect(ja.label).toBe("Whistler's Mother");
    expect(ja.summary).toHaveLength(1);
  });

  it('0118 multivalue: all values of a language', () => {
    const en = aboutFor('0118-multivalue', 'en').manifest;
    expect(en.metadata[0].label).toBe('Alternative titles');
    expect(en.metadata[0].values).toEqual(["Whistler's Mother", 'Arrangement in Grey and Black No. 1']);
  });

  it('0029 metadata anywhere: Manifest and Canvas', () => {
    const m = load('0029-metadata-anywhere');
    const first = (m.items?.[0] as { id: string }).id;
    const second = (m.items?.[1] as { id: string }).id;
    const a = aboutOf(m, first, 'en')!;
    const b = aboutOf(m, second, 'en')!;
    expect(a.manifest.metadata.length).toBeGreaterThan(0);
    expect(a.container?.metadata.length).toBeGreaterThan(0);
    expect(b.container?.metadata.length).toBeGreaterThan(0);
    expect(a.container?.metadata[0].values).not.toEqual(b.container?.metadata[0].values);
  });

  it('metadata of a Range is read', () => {
    const info = aboutOf(
      {
        items: [],
        structures: [
          {
            id: 'r1',
            type: 'Range',
            label: { en: ['Chapter'] },
            metadata: [{ label: { en: ['Author'] }, value: { en: ['A'] } }],
            items: [{ id: 'r2', type: 'Range', summary: { en: ['inner'] }, items: [] }],
          },
        ],
      } as never,
      undefined,
      'en',
    )!;
    expect(info.ranges.map((r) => r.id)).toEqual(['r1', 'r2']);
    expect(info.ranges[0].metadata[0].values).toEqual(['A']);
  });
});

describe('cookbook: strings and statements', () => {
  it('0007 string formats: HTML values stay safe, text is plain', () => {
    const m = aboutFor('0007-string-formats').manifest;
    expect(m.summary[0]).toContain('<a href="https://github.com/glenrobson"');
    expect(m.metadata[0].html[0]).toContain('<span>');
    expect(m.metadata[0].values[0]).toBe('Glen Robson');
    expect(m.requiredStatement?.label).toBe('Attribution');
    expect(m.requiredStatement?.html[0]).toContain('licensebuttons.net');
  });

  it('0008 rights', () => {
    const m = aboutFor('0008-rights').manifest;
    expect(m.rights?.url).toBe('http://creativecommons.org/licenses/by-sa/3.0/');
    expect(m.requiredStatement?.values[0]).toMatch(/Glen Robson/);
  });

  it('0045 css: unknown style fields do not break reading', () => {
    const info = aboutFor('0045-css', 'ja');
    expect(info.manifest.label).toBe('琴棋書画図屏風');
  });

  it('0057 publishing v2 and v3: a minimal manifest has nothing but a label', () => {
    const info = aboutFor('0057-publishing-v2-and-v3');
    expect(info.manifest.label).toMatch(/Minimum Viable Manifest/);
    expect(aboutHasContent(info)).toBe(false);
  });

  it('a Presentation 2 shaped manifest is read as far as possible', () => {
    const info = aboutOf(
      {
        '@id': 'https://e.org/m',
        '@type': 'sc:Manifest',
        label: [{ '@value': 'Old', '@language': 'en' }],
        attribution: 'Owner',
        license: 'https://creativecommons.org/licenses/by/4.0/',
        logo: 'https://e.org/logo.png',
        description: 'Desc <script>x</script>',
        related: 'https://e.org/home',
        metadata: [{ label: 'Date', value: '1900' }],
      } as never,
      undefined,
      'en',
    )!.manifest;
    expect(info.label).toBe('Old');
    expect(info.requiredStatement?.values).toEqual(['Owner']);
    expect(info.rights?.url).toMatch(/creativecommons/);
    expect(info.providers[0].logos).toEqual(['https://e.org/logo.png']);
    expect(info.summary).toEqual(['Desc ']);
    expect(info.homepage[0].id).toBe('https://e.org/home');
    expect(info.metadata[0].values).toEqual(['1900']);
  });
});

describe('cookbook: links and providers', () => {
  it('0234 provider: name, logo, homepage', () => {
    const p = aboutFor('0234-provider').manifest.providers;
    expect(p).toHaveLength(1);
    expect(p[0].label).toBe('UCLA Library');
    expect(p[0].logos[0]).toMatch(/UCLA-Library-Logo/);
    expect(p[0].homepage[0].id).toBe('https://digital.library.ucla.edu/');
  });

  it('0047 homepage', () => {
    const h = aboutFor('0047-homepage').manifest.homepage;
    expect(h[0].id).toBe('https://www.getty.edu/art/collection/object/103RQQ');
    expect(h[0].format).toBe('text/html');
  });

  it('0046 rendering: download links with format', () => {
    const r = aboutFor('0046-rendering').manifest.rendering;
    expect(r[0]).toMatchObject({ label: 'PDF version', format: 'application/pdf' });
  });

  it('0053 seeAlso', () => {
    const s = aboutFor('0053-seeAlso').manifest.seeAlso;
    expect(s[0]).toMatchObject({ label: 'MODS metadata', type: 'Dataset' });
  });

  it('does not take URLs from non-string ids', () => {
    const info = aboutOf({ items: [], seeAlso: [{ id: 42 }, null, 'https://e.org/x'] } as never, undefined, 'en')!;
    expect(info.manifest.seeAlso.map((l) => l.id)).toEqual(['https://e.org/x']);
  });
});

describe('cookbook: date and place', () => {
  it('0230 navDate', () => {
    const d = aboutFor('0230-navdate', 'en').manifest.navDate!;
    expect(d.iso).toBe('1986-01-01T00:00:00Z');
    expect(d.text).toMatch(/1986/);
    expect(aboutFor('0230-navdate', 'ja').manifest.navDate!.text).toMatch(/1986年/);
  });

  it('0318 navPlace and navDate', () => {
    const m = aboutFor('0318-navPlace-navDate').manifest;
    expect(m.navDate?.text).toMatch(/1776/);
    expect(m.places).toHaveLength(1);
    expect(m.places[0].label).toBe("Castel Sant'Angelo, Rome");
    expect(m.places[0].center).toEqual({ lat: 41.9031, lng: 12.4663 });
    expect(m.places[0].url).toContain('mlat=41.9031');
    expect(m.places[0].url).toContain('mlon=12.4663');
  });

  it('0154 geo extension: label in the reader language', () => {
    expect(aboutFor('0154-geo-extension', 'it').manifest.places[0].label).toBe('Bronzo Laocoonte e i suoi figli');
    expect(aboutFor('0154-geo-extension', 'en').manifest.places[0].label).toBe('The Laocoön Bronze');
    expect(aboutFor('0154-geo-extension', 'en').manifest.places[0].center.lat).toBeCloseTo(34.0776, 3);
  });

  it('0240 navPlace on canvases: each canvas has its own place', () => {
    const m = load('0240-navPlace-on-canvases');
    const [c1, c2] = (m.items as { id: string }[]).map((c) => c.id);
    const a = aboutOf(m, c1, 'en')!;
    const b = aboutOf(m, c2, 'en')!;
    expect(a.manifest.places).toHaveLength(0);
    expect(a.container?.places[0].label).toBe('Current Location of the Laocoön Bronze');
    expect(b.container?.places[0].label).toBe('Current Location of Painting');
    expect(a.container?.places[0].center.lng).toBeLessThan(b.container!.places[0].center.lng);
  });

  it('0139 geolocate a canvas fragment: Feature in a tagging Annotation, with the region', () => {
    const c = aboutFor('0139-geolocate-canvas-fragment').container!;
    expect(c.places).toHaveLength(1);
    const p = c.places[0];
    expect(p.source).toBe('annotation');
    expect(p.geometry).toBe('Polygon');
    expect(p.target).toBe('#xywh=920,3600,1510,3000');
    expect(p.points).toBeGreaterThanOrEqual(4);
    expect(p.bbox![0]).toBeLessThan(p.bbox![2]);
    expect(p.label).toMatch(/Targeted Map/);
  });

  it('ignores invalid coordinates', () => {
    const info = aboutOf(
      {
        items: [],
        navPlace: { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [500, 99] } }] },
      } as never,
      undefined,
      'en',
    )!;
    expect(info.manifest.places).toEqual([]);
  });
});

describe('aboutOf', () => {
  it('returns null without a manifest', () => {
    expect(aboutOf(null, undefined, 'en')).toBeNull();
  });
});
