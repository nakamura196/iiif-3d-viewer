// 国立国会図書館の電子展示会「ひろげて・まいて・あらわれる 絵巻の世界」の 1 節を、
// ストーリー（describing 注釈を順に読む）のマニフェストにする。
//
//   node scripts/build-ndl-emaki-story.mjs            # 第2章第2節（既定）
//   node scripts/build-ndl-emaki-story.mjs --page 22 --out public/manifests/ndl-emaki-story.json
//
// 展示会の解説と画像は、申込み不要・出典の記載で使える（https://www.ndl.go.jp/d_exhibitions/emaki/about）。
// 本文は展示会の文章をそのまま使い、こちらでは書き足さない。場面の領域も、展示会のページが
// 画像を切り出している IIIF Image API の領域（pid / コマ / xywh）をそのまま使う。
// 1 資料 = 1 場面（展示会が並べた画像のうち最初のコマ）。小見出しごとに章（Range）を立て、
// 章の頭に小見出しの導入文をコマ全体で出す。経緯は docs/notes/storytelling.md
import { writeFile } from 'node:fs/promises';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const PAGE = opt('page', '22');
const OUT = opt('out', 'public/manifests/ndl-emaki-story.json');
const SITE = 'https://www.ndl.go.jp/d_exhibitions/emaki';
const PAGE_URL = `${SITE}/${PAGE}`;
const SELF = 'https://kasane.ldas.jp/manifests/ndl-emaki-story.json';

const decode = (s) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
const clean = (s) =>
  decode(s.replace(/<br\s*\/?>/g, '\n').replace(/<[^>]+>/g, ''))
    .replace(/[ \t]+\n/g, '\n')
    .trim();
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const paragraphs = (s) =>
  s
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => `<p>${esc(l)}</p>`)
    .join('');

// 見出し（h1 = 節、h2 = 小見出しか資料名）、段落（class で役割が分かる）、画像の順に読む。
// 資料: h2 の直後に目録の行（p.es）、本文（p.ar / p.ara と続きの p.br）、画像の並び。
// 小見出し: h2 の直後が目録の行でない段落
const TOKEN =
  /<h1[^>]*>(?<h1>[\s\S]*?)<\/h1>|<h2[^>]*>(?<h2>[\s\S]*?)<\/h2>|<p class="base-paragraph (?<pcls>[^"]*)"[^>]*>(?<p>[\s\S]*?)<\/p>|<img class="base-image" src="https:\/\/dl\.ndl\.go\.jp\/api\/iiif\/(?<pid>\d+)\/R0*(?<koma>\d+)\/(?<xywh>\d+,\d+,\d+,\d+)\//g;

function parse(html) {
  const s = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<svg[\s\S]*?<\/svg>/g, '');
  const out = { section: null, intro: '', groups: [] };
  let group = null;
  let item = null;
  let pendingH2 = null;
  let afterH1 = false;
  for (const m of s.matchAll(TOKEN)) {
    const g = m.groups;
    if (g.h1 !== undefined) {
      if (clean(g.h1)) out.section = clean(g.h1);
      afterH1 = true;
    } else if (g.h2 !== undefined) {
      pendingH2 = clean(g.h2);
      item = null;
      afterH1 = false;
    } else if (g.p !== undefined) {
      const cls = g.pcls.split(/\s+/);
      const text = clean(g.p);
      if (afterH1 && text && !out.intro) {
        out.intro = text;
      } else if (cls.includes('es') && pendingH2) {
        if (!group) out.groups.push((group = { title: null, intro: '', items: [] }));
        group.items.push((item = { title: pendingH2, catalog: text, text: '', images: [] }));
        pendingH2 = null;
      } else if (pendingH2 && !item) {
        out.groups.push((group = { title: pendingH2, intro: text, items: [] }));
        pendingH2 = null;
      } else if (item && !item.images.length && ['ar', 'ara', 'br'].some((c) => cls.includes(c))) {
        item.text = `${item.text}\n${text}`.trim();
      }
    } else if (g.pid && item && Number(g.koma) > 0) {
      // 展示会のページには、コマ番号の抜けた指定（R0000）が混じることがある。それは飛ばす
      const img = { pid: g.pid, koma: Number(g.koma), xywh: g.xywh };
      if (!item.images.some((x) => x.pid === img.pid && x.koma === img.koma)) item.images.push(img);
    }
  }
  return out;
}

async function getJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
}

// 国立国会図書館デジタルコレクションの P2 マニフェストから、コマの大きさと画像の配信先を取る
const manifests = new Map();
async function ndlCanvas(pid, koma) {
  if (!manifests.has(pid)) manifests.set(pid, await getJson(`https://dl.ndl.go.jp/api/iiif/${pid}/manifest.json`));
  const m = manifests.get(pid);
  const id = `https://dl.ndl.go.jp/api/iiif/${pid}/canvas/${koma}`;
  const c = m.sequences[0].canvases.find((x) => x['@id'] === id);
  if (!c) throw new Error(`no canvas ${id}`);
  const res = c.images[0].resource;
  return {
    id,
    width: c.width,
    height: c.height,
    label: typeof m.label === 'string' ? m.label : String(m.label?.[0]?.['@value'] ?? pid),
    image: res['@id'],
    service: res.service['@id'],
    format: res.format ?? 'image/jpeg',
  };
}

const html = await (await fetch(PAGE_URL)).text();
const page = parse(html);
if (!page.groups.length) throw new Error('no items found');

const SOURCE_JA = `出典：国立国会図書館「絵巻の世界」（${PAGE_URL}）を加工して作成`;
const textBody = (value) => ({ type: 'TextualBody', value, format: 'text/html', language: 'ja' });

const canvases = [];
const ranges = [];
for (const [gi, group] of page.groups.entries()) {
  const rangeItems = [];
  for (const [ii, item] of group.items.entries()) {
    if (!item.images.length) {
      console.warn(`skip (no image): ${item.title}`);
      continue;
    }
    const img = item.images[0];
    const c = await ndlCanvas(img.pid, img.koma);
    const annos = [];
    // 章の頭: 小見出しの導入文を、コマ全体に付ける
    if (group.title && !rangeItems.length) {
      annos.push({
        id: `${SELF}/annotation/g${gi + 1}`,
        type: 'Annotation',
        motivation: 'describing',
        body: textBody(`<h2>${esc(group.title)}</h2>${paragraphs(group.intro)}`),
        target: c.id,
      });
    }
    annos.push({
      id: `${SELF}/annotation/g${gi + 1}-${ii + 1}`,
      type: 'Annotation',
      motivation: 'describing',
      body: textBody(`<h2>${esc(item.title)}</h2><p>${esc(item.catalog)}</p>${paragraphs(item.text)}`),
      target: `${c.id}#xywh=${img.xywh}`,
    });
    canvases.push({
      id: c.id,
      type: 'Canvas',
      label: { ja: [`${item.title}（${img.koma} コマ目）`] },
      width: c.width,
      height: c.height,
      items: [
        {
          id: `${SELF}/page/${img.pid}-${img.koma}`,
          type: 'AnnotationPage',
          items: [
            {
              id: `${SELF}/painting/${img.pid}-${img.koma}`,
              type: 'Annotation',
              motivation: 'painting',
              body: {
                id: c.image,
                type: 'Image',
                format: c.format,
                width: c.width,
                height: c.height,
                service: [{ id: c.service, type: 'ImageService2', profile: 'level2' }],
              },
              target: c.id,
            },
          ],
        },
      ],
      annotations: [{ id: `${SELF}/annotations/${img.pid}-${img.koma}`, type: 'AnnotationPage', items: annos }],
      seeAlso: [
        {
          id: `https://dl.ndl.go.jp/pid/${img.pid}/1/${img.koma}`,
          type: 'Text',
          format: 'text/html',
          label: { ja: [`国立国会図書館デジタルコレクション「${c.label}」`] },
        },
      ],
    });
    rangeItems.push({ id: c.id, type: 'Canvas' });
  }
  if (group.title && rangeItems.length) {
    ranges.push({ id: `${SELF}/range/g${gi + 1}`, type: 'Range', label: { ja: [group.title] }, items: rangeItems });
  }
}

const manifest = {
  '@context': 'http://iiif.io/api/presentation/3/context.json',
  id: SELF,
  type: 'Manifest',
  label: {
    ja: [`絵巻の世界「${page.section}」（国立国会図書館 電子展示会より）`],
    en: [`The World of Emaki: “${page.section}” (from a National Diet Library online exhibition)`],
  },
  summary: { ja: [page.intro] },
  requiredStatement: {
    label: { ja: ['出典'], en: ['Source'] },
    value: {
      ja: [`${SOURCE_JA}。画像：国立国会図書館デジタルコレクション`],
      en: [
        `Text adapted from the National Diet Library online exhibition “Emaki no Sekai” (${PAGE_URL}). Images: National Diet Library Digital Collections`,
      ],
    },
  },
  homepage: [{ id: PAGE_URL, type: 'Text', format: 'text/html', label: { ja: ['絵巻の世界（国立国会図書館）'] } }],
  provider: [
    {
      id: 'https://www.ndl.go.jp/',
      type: 'Agent',
      label: { ja: ['国立国会図書館'], en: ['National Diet Library'] },
    },
  ],
  items: canvases,
  structures: ranges.length
    ? [{ id: `${SELF}/range/toc`, type: 'Range', label: { ja: [page.section] }, items: ranges }]
    : undefined,
};

await writeFile(OUT, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`${OUT}: ${canvases.length} canvases, ${ranges.length} chapters`);
