#!/usr/bin/env node
/**
 * 本番 (3d.ldas.jp) と旧 URL の転送を、実際に HTTP で叩いて確かめる。
 * マージ (= Pages の配布) と独自ドメインの設定後に手元で実行する: npm run test:live
 *
 * 見ること:
 *   1. 新ホストの各ページが 200 で、canonical がそのページ自身
 *   2. ページが読む /_next の資産、robots.txt・sitemap.xml、サンプルの manifest と 3D モデルが 200
 *      (manifest の id は新ホスト、manifest とモデルは他サイトのビューアからも読めるよう CORS *)
 *   3. 存在しないパスが 404、http は https へ転送
 *   4. 旧 github.io/iiif-3d-viewer/<path>?<query> が同じパス・クエリのまま 301 で新ホストへ
 *   5. 旧 3d-iiif-viewer.vercel.app/<path>?<query> が同じパス・クエリのまま 308 で新ホストへ
 */
const NEW = 'https://3d.ldas.jp';
const OLD_PAGES = 'https://nakamura196.github.io/iiif-3d-viewer';
const OLD_VERCEL = 'https://3d-iiif-viewer.vercel.app';

const errors = [];
let passed = 0;
const ok = (cond, msg) => (cond ? passed++ : errors.push(msg));
const get = (url, opts = {}) => fetch(url, { redirect: 'manual', ...opts });

// 1
const assets = new Set();
for (const page of ['/ja/', '/en/', '/ja/viewer/', '/en/help/', '/ja/georef/', '/ja/privacy/', '/en/terms/']) {
  const r = await get(NEW + page);
  ok(r.status === 200, `${NEW}${page} → ${r.status} (200 のはず)`);
  const html = await r.text();
  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
  ok(canonical === NEW + page, `${page} の canonical が ${canonical}`);
  ok(!html.includes('github.io/iiif-3d-viewer'), `${page} に旧ホストの文字列が残っている`);
  for (const m of html.matchAll(/(?:href|src)="(\/_next\/[^"]+)"/g)) assets.add(m[1]);
}
{
  const r = await get(NEW + '/');
  ok(r.status === 200, `${NEW}/ → ${r.status}`);
}

// 2
ok(assets.size > 0, '/_next の資産参照が見つからない');
for (const path of [...assets, '/robots.txt', '/sitemap.xml', '/manifest.json', '/icon.svg']) {
  const r = await get(NEW + path, { method: 'HEAD' });
  ok(r.status === 200, `${NEW}${path} → ${r.status}`);
}
{
  const txt = await (await get(NEW + '/robots.txt')).text();
  ok(txt.includes(`Sitemap: ${NEW}/sitemap.xml`), 'robots.txt の Sitemap 行が新ホストでない');
  const xml = await (await get(NEW + '/sitemap.xml')).text();
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  ok(locs.length > 0 && locs.every((u) => u.startsWith(NEW + '/')), `sitemap の loc: ${locs.join(', ')}`);
}
for (const name of ['sample-manifest.json', 'sample-manifest-with-annotations.json']) {
  const url = `${NEW}/manifests/${name}`;
  const r = await get(url, { headers: { Origin: 'https://example.org' } });
  ok(r.status === 200, `${url} → ${r.status}`);
  ok(r.headers.get('access-control-allow-origin') === '*', `${url} の CORS: ${r.headers.get('access-control-allow-origin')}`);
  const json = await r.json();
  ok(json.id === url, `${name} の id が ${json.id}`);
  const models = [...JSON.stringify(json).matchAll(/"(https:\/\/[^"]+\.glb)"/g)].map((m) => m[1]);
  ok(models.length > 0, `${name} にモデルの URL が無い`);
  for (const m of new Set(models)) {
    ok(m.startsWith(NEW + '/'), `${name} のモデル URL が新ホストでない: ${m}`);
    const h = await get(m, { method: 'HEAD', headers: { Origin: 'https://example.org' } });
    ok(h.status === 200 && h.headers.get('access-control-allow-origin') === '*', `${m} → ${h.status} CORS ${h.headers.get('access-control-allow-origin')}`);
  }
}

// 3
{
  const r = await get(NEW + '/no-such-page/');
  ok(r.status === 404, `存在しないページが ${r.status} (404 のはず)`);
  const h = await get('http://3d.ldas.jp/ja/help/?q=1');
  const loc = h.headers.get('location');
  ok([301, 308].includes(h.status) && loc === `${NEW}/ja/help/?q=1`, `http → ${h.status} ${loc}`);
}

// 4, 5
const viewer = `/ja/viewer/?manifest=${encodeURIComponent(NEW + '/manifests/sample-manifest.json')}`;
const paths = ['/', '/ja/', '/en/help/', viewer, '/manifests/sample-manifest.json'];
for (const [base, status] of [[OLD_PAGES, 301], [OLD_VERCEL, 308]]) {
  for (const path of paths) {
    const r = await get(base + path);
    const loc = r.headers.get('location');
    ok(r.status === status && loc === NEW + path, `${base}${path} → ${r.status} ${loc} (${status} ${NEW + path} のはず)`);
  }
}

if (errors.length) {
  console.error(`NG: ${errors.length} 件 (OK ${passed} 件)`);
  for (const e of errors) console.error('  ' + e);
  process.exit(1);
}
console.log(`OK: ${passed} 件`);
