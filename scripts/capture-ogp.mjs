#!/usr/bin/env node
/**
 * トップの OGP 画像（SNS でリンクを貼ったときに出る絵）を作る。
 * ユースケースの 1 つ（既定は国絵図の見比べ）を Kasane で開いて画面を撮り、
 * 下にサイト名と説明を重ねて src/app/opengraph-image.png と twitter-image.png（同じ絵）に書き出す。
 *
 * 使い方:
 *   node scripts/capture-ogp.mjs                       # 本番 https://kasane.ldas.jp を開いて撮る
 *   node scripts/capture-ogp.mjs --usecase iiif-geo    # 別のユースケースの画面にする
 *   node scripts/capture-ogp.mjs --wait 30000          # 画像サーバが遅いとき、開いてから撮るまでを延ばす（ミリ秒）
 *
 * 前提: Google Chrome（Playwright の channel: 'chrome' で使う）。Node 23.6 以降（TypeScript を直接読む）。
 */
import { copyFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import sharp from 'sharp';

await import('./lib/ts-hooks.mjs');
const { USE_CASES, hrefOf } = await import('../src/lib/usecases.ts');

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i < 0 ? undefined : process.argv[i + 1];
};
const SITE = 'https://kasane.ldas.jp';
const base = (arg('base') ?? SITE).replace(/\/$/, '');
const id = arg('usecase') ?? 'kuniezu';
const wait = Number(arg('wait') ?? 20000);

// OGP の推奨は 1200x630。画面は 4/3 倍の大きさで撮って縮め、文字がつぶれないようにする
const OUT_W = 1200;
const OUT_H = 630;
const SHOT_W = 1600;
const SHOT_H = 840;
const HEADER = 41; // サイトのヘッダー。写さない

const u = USE_CASES.find((x) => x.id === id);
if (!u) throw new Error(`ユースケースがありません: ${id}`);
const url = `${base}/en${hrefOf(u.open)}`;

const browser = await chromium.launch({ channel: 'chrome' });
// 国立公文書館の画像サーバは HeadlessChrome を名乗ると 403 を返すので、ふつうの Chrome の名乗りにする
const ua = (await browser.newPage().then((p) => p.evaluate(() => navigator.userAgent))).replace('HeadlessChrome', 'Chrome');
const page = await browser.newPage({ viewport: { width: SHOT_W, height: SHOT_H + HEADER }, userAgent: ua });
await page.goto(url);
await page.waitForTimeout(wait);
const shot = await page.screenshot({ clip: { x: 0, y: HEADER, width: SHOT_W, height: SHOT_H } });
await browser.close();

// 下の帯: 画面を暗くするグラデーションの上に、サイト名と一行の説明
const overlay = Buffer.from(`<svg width="${OUT_W}" height="${OUT_H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0f172a" stop-opacity="0"/>
      <stop offset="0.55" stop-color="#0f172a" stop-opacity="0.82"/>
      <stop offset="1" stop-color="#0f172a" stop-opacity="0.92"/>
    </linearGradient>
  </defs>
  <rect x="0" y="${OUT_H - 250}" width="${OUT_W}" height="250" fill="url(#g)"/>
  <text x="56" y="${OUT_H - 86}" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="76" font-weight="700" fill="#ffffff">IIIF Kasane</text>
  <text x="58" y="${OUT_H - 40}" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="29" fill="#e2e8f0">Layer 3D models, images, audio, video and annotations in one view</text>
</svg>`);

const out = path.join(ROOT, 'src/app/opengraph-image.png');
const info = await sharp(shot)
  .resize(OUT_W, OUT_H)
  .composite([{ input: overlay }])
  .png({ compressionLevel: 9, palette: true, quality: 90 }) // 減色して 300 KB 前後に収める
  .toFile(out);
copyFileSync(out, path.join(ROOT, 'src/app/twitter-image.png'));
console.log(`src/app/opengraph-image.png, twitter-image.png  ${OUT_W}x${OUT_H}  ${Math.round(info.size / 1024)} KB  ← ${url}`);
