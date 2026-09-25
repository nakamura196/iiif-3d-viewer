#!/usr/bin/env node
/**
 * 静的書き出し (out/) の中のリンクと資産の参照が、すべて実在するファイルを指しているか確かめる。
 *
 * 使い方: npm run build のあとに npm run test:export
 *   basePath 付き (GITHUB_PAGES=true) でビルドしたときは NEXT_PUBLIC_BASE_PATH=/iiif-3d-viewer を付けて実行する。
 *
 * 見ること:
 *   1. HTML の href / src / srcset / content と CSS の url() のうち、サイト内を指すもの
 *      (/ で始まる参照・相対参照・サイトの絶対 URL) が out/ のファイルに解決できる
 *   2. / で始まる参照が basePath から始まっている (basePath の付け忘れ・二重付け)
 *   3. 旧ホスト (github.io/iiif-3d-viewer, 3d-iiif-viewer.vercel.app) を指す文字列が残っていない
 *   4. robots.txt の Sitemap と sitemap.xml の各 URL が実在するページを指す
 *   5. トップ (index.html) と 404.html がある
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, posix } from 'node:path';

const OUT = new URL('../out/', import.meta.url).pathname;
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/+$/, '');
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://3d.ldas.jp').replace(/\/+$/, '');

const FORBIDDEN = ['nakamura196.github.io/iiif-3d-viewer', '3d-iiif-viewer.vercel.app'];

const errors = [];
const fail = (msg) => errors.push(msg);

if (!existsSync(OUT)) {
  console.error('out/ がありません。先に npm run build を実行してください。');
  process.exit(1);
}

function walk(dir) {
  const files = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) files.push(...walk(p));
    else files.push(p);
  }
  return files;
}

/** out/ 内の配信パス (basePath を除いたもの) がファイルに解決できるか。GitHub Pages と同じ規則。 */
function resolves(servedPath) {
  let p = decodeURIComponent(servedPath.split(/[?#]/)[0]);
  if (p === '' || p.endsWith('/')) p += 'index.html';
  const abs = join(OUT, p);
  if (!abs.startsWith(OUT)) return false;
  if (existsSync(abs) && statSync(abs).isFile()) return true;
  if (existsSync(abs + '.html')) return true;
  if (existsSync(join(abs, 'index.html'))) return true;
  return false;
}

const files = walk(OUT);
let checkedRefs = 0;

function checkRef(ref, file) {
  const where = relative(OUT, file);
  if (!ref || ref.startsWith('#') || ref.startsWith('data:') || ref.startsWith('mailto:')) return;
  if (/^[a-z][a-z0-9+.-]*:/i.test(ref) || ref.startsWith('//')) {
    // 外部 URL。サイト自身の絶対 URL だけ確かめる (canonical, hreflang, og:image など)。
    if (ref === siteUrl || ref.startsWith(siteUrl + '/')) {
      checkedRefs++;
      const path = ref.slice(siteUrl.length).replace(/^\//, '');
      if (!resolves(path)) fail(`${where}: サイトの絶対 URL がファイルに解決できない: ${ref}`);
    }
    return;
  }
  checkedRefs++;
  if (ref.startsWith('/')) {
    if (basePath && !(ref === basePath || ref.startsWith(basePath + '/'))) {
      fail(`${where}: basePath (${basePath}) の付いていない参照: ${ref}`);
      return;
    }
    const rest = ref.slice(basePath.length).replace(/^\//, '');
    if (basePath && rest.startsWith(basePath.slice(1) + '/')) {
      fail(`${where}: basePath が二重に付いている参照: ${ref}`);
      return;
    }
    if (!resolves(rest)) fail(`${where}: 参照先のファイルが無い: ${ref}`);
    return;
  }
  // 相対参照は、そのファイルの置き場所から解決する。
  const fromDir = posix.dirname(relative(OUT, file).split('\\').join('/'));
  const target = posix.normalize(posix.join(fromDir, ref.split(/[?#]/)[0]));
  if (target.startsWith('..')) {
    fail(`${where}: out/ の外を指す相対参照: ${ref}`);
    return;
  }
  if (!resolves(target + (ref.split(/[?#]/)[0].endsWith('/') ? '/' : ''))) {
    fail(`${where}: 相対参照の先のファイルが無い: ${ref}`);
  }
}

for (const file of files) {
  const where = relative(OUT, file);
  if (!/\.(html|css|js|txt|xml|json)$/.test(file)) continue;
  const text = readFileSync(file, 'utf8');

  for (const bad of FORBIDDEN) {
    if (text.includes(bad)) fail(`${where}: 旧ホストへの参照が残っている: ${bad}`);
  }

  if (file.endsWith('.html')) {
    for (const m of text.matchAll(/\s(?:href|src|content)="([^"]*)"/g)) {
      const v = m[1].replaceAll('&amp;', '&');
      // content 属性は meta の値。URL らしいものだけを対象にする。
      if (m[0].trimStart().startsWith('content=')) {
        if (!(v.startsWith('/') || v.startsWith(siteUrl))) continue;
      }
      checkRef(v, file);
    }
    for (const m of text.matchAll(/\ssrcset="([^"]*)"/g)) {
      for (const part of m[1].split(',')) checkRef(part.trim().split(/\s+/)[0], file);
    }
    for (const m of text.matchAll(/http-equiv="refresh"\s+content="\d+;\s*url=([^"]+)"/gi)) {
      checkRef(m[1], file);
    }
  }
  if (file.endsWith('.css')) {
    for (const m of text.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
      checkRef(m[1], file);
    }
  }
}

// トップと 404
for (const must of ['index.html', '404.html']) {
  if (!existsSync(join(OUT, must))) fail(`${must} が無い`);
}

// robots.txt と sitemap.xml
const robotsPath = join(OUT, 'robots.txt');
if (!existsSync(robotsPath)) {
  fail('robots.txt が無い');
} else {
  const robots = readFileSync(robotsPath, 'utf8');
  const expected = `Sitemap: ${siteUrl}/sitemap.xml`;
  if (!robots.includes(expected)) fail(`robots.txt に "${expected}" が無い`);
}
const sitemapPath = join(OUT, 'sitemap.xml');
if (!existsSync(sitemapPath)) {
  fail('sitemap.xml が無い');
} else {
  const locs = [...readFileSync(sitemapPath, 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map(
    (m) => m[1],
  );
  if (locs.length === 0) fail('sitemap.xml に URL が 1 件も無い');
  for (const loc of locs) checkRef(loc, sitemapPath);
}

if (errors.length) {
  console.error(`NG: ${errors.length} 件 (basePath="${basePath}", siteUrl=${siteUrl})`);
  for (const e of errors.slice(0, 50)) console.error('  ' + e);
  if (errors.length > 50) console.error(`  ... ほか ${errors.length - 50} 件`);
  process.exit(1);
}
console.log(
  `OK: ${files.length} ファイル、サイト内参照 ${checkedRefs} 件 (basePath="${basePath}", siteUrl=${siteUrl})`,
);
