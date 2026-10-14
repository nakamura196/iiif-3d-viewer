#!/usr/bin/env node
/**
 * サンプル（/samples）とユースケース（/usecases、トップの入力欄の下）のサムネイルを撮る。
 * 各サンプルを Kasane のビューアで開き、その画面をヘッドレスの Chrome で撮って、
 * public/thumbnails/<samples|usecases>/<id>.webp に縮小して書き出す。
 * 資料の画像ではなくビューアの画面を撮るのは、「開くと何ができるか」（注釈・文字起こし・比較など）を見せたいため。
 *
 * 使い方:
 *   node scripts/capture-thumbnails.mjs                 # 全部撮る（本番 https://kasane.ldas.jp を開く）
 *   node scripts/capture-thumbnails.mjs --only 0021,shelley
 *   node scripts/capture-thumbnails.mjs --base http://localhost:3838   # 手元の開発サーバを開く
 *   node scripts/capture-thumbnails.mjs --missing       # まだ無いものだけ撮る（サンプルを足したとき）
 *
 * 前提: Google Chrome（別の場所なら CHROME=<実行ファイル> で指定）。Node 23.6 以降（TypeScript を直接読む）。
 * 開発サーバで撮ると、画面の隅に Next.js の印が写る。本番で撮るほうがきれい。
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

// src/ の TypeScript を読めるようにしてから、サンプルの一覧を読む
await import('./lib/ts-hooks.mjs');
const { SAMPLES, sampleHref } = await import('../src/lib/samples.ts');
const { USE_CASES, hrefOf } = await import('../src/lib/usecases.ts');

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i < 0 ? undefined : process.argv[i + 1];
};
const base = (arg('base') ?? 'https://kasane.ldas.jp').replace(/\/$/, '');
const only = arg('only')?.split(',');
const missingOnly = process.argv.includes('--missing');

// 撮る画面の大きさ。上端のサイトのヘッダー（HEADER px）は写さず、16:10 で残す
const WIDTH = 1280;
const HEIGHT = 800;
const HEADER = 41;
const OUT_WIDTH = 640;

// 撮る前にページで行う操作（id ごと）。画面を開いただけでは見どころが写らないものに使う
const PREPARE = {
  // 地球儀のピンは裏側にあるので、アノテーションの 1 件目を押して、その場所へ視点を移す
  'globe-annotations': `[...document.querySelectorAll('.cursor-pointer')].find((e) => e.textContent.includes('北海'))?.click()`,
  // 開いた直後は巻物の全体なので、一覧の場面を 1 つ押して、そこへ寄った画面を撮る
  'wakozukan-story': `[...document.querySelectorAll('nav button')].find((e) => e.textContent.includes('倭寇の上陸'))?.click()`,
};
// 操作のあと撮るまでの待ち時間（既定 3 秒）。深く寄ると、細かいタイルが届くまで時間がかかる
const PREPARE_WAIT = { 'wakozukan-story': 12000 };

const targets = [
  ...SAMPLES.map((s) => ({
    id: s.id,
    file: `public/thumbnails/samples/${s.id}.webp`,
    href: sampleHref(s),
    // 開いてから撮るまでの待ち時間。3D は読み込みに 15〜20 秒かかる
    wait: s.media === '3d' ? 30000 : 10000,
  })),
  ...USE_CASES.map((u) => ({
    id: u.id,
    file: `public/thumbnails/usecases/${u.id}.webp`,
    href: hrefOf(u.open),
    wait: 15000,
  })),
].filter((t) => (!only || only.includes(t.id)) && (!missingOnly || !existsSync(path.join(ROOT, t.file))));

// Chrome を 1 つ立ち上げ、DevTools Protocol（外からページを操作する窓口）で各ページを開いて撮る。
// 画面を撮るだけなら --screenshot で足りるが、動画は 0 秒目が黒いので、途中まで進めてから撮りたい
const profile = mkdtempSync(path.join(tmpdir(), 'kasane-thumbs-'));
const chrome = spawn(CHROME, [
  '--headless=new',
  '--hide-scrollbars',
  '--mute-audio',
  '--enable-unsafe-swiftshader', // 3D（WebGL）をヘッドレスで描く
  '--remote-debugging-port=0',
  `--user-data-dir=${profile}`,
  `--window-size=${WIDTH},${HEIGHT + HEADER}`,
  'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] });
const wsUrl = await new Promise((resolve, reject) => {
  let buf = '';
  chrome.stderr.on('data', (d) => {
    buf += d;
    const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
    if (m) resolve(m[1]);
  });
  chrome.on('exit', () => reject(new Error(`Chrome が起動しませんでした: ${buf}`)));
});

const ws = new WebSocket(wsUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let nextId = 0;
const pending = new Map();
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  const p = pending.get(msg.id);
  if (!p) return;
  pending.delete(msg.id);
  if (msg.error) p.reject(new Error(msg.error.message));
  else p.resolve(msg.result);
});
const send = (method, params = {}, sessionId) =>
  new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ページに入っている動画を、長さの 1/4 の位置で止める（読み込めていない動画は放っておく）
const SEEK_VIDEOS = `Promise.all([...document.querySelectorAll('video')].map((v) => new Promise((done) => {
  if (!(v.duration > 0)) return done();
  v.pause();
  v.addEventListener('seeked', () => done(), { once: true });
  v.currentTime = v.duration / 4;
  setTimeout(done, 5000);
})))`;

let failed = 0;
for (const t of targets) {
  const url = `${base}/ja${t.href}`;
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  try {
    await send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: HEIGHT + HEADER, deviceScaleFactor: 1, mobile: false }, sessionId);
    await send('Page.navigate', { url }, sessionId);
    await sleep(t.wait);
    if (PREPARE[t.id]) {
      await send('Runtime.evaluate', { expression: PREPARE[t.id] }, sessionId);
      await sleep(PREPARE_WAIT[t.id] ?? 3000);
    }
    await send('Runtime.evaluate', { expression: SEEK_VIDEOS, awaitPromise: true }, sessionId);
    await sleep(500);
    const { data } = await send('Page.captureScreenshot', {
      format: 'png',
      clip: { x: 0, y: HEADER, width: WIDTH, height: HEIGHT, scale: 1 },
    }, sessionId);
    const out = path.join(ROOT, t.file);
    mkdirSync(path.dirname(out), { recursive: true });
    const info = await sharp(Buffer.from(data, 'base64'))
      .resize({ width: OUT_WIDTH })
      .webp({ quality: 72 })
      .toFile(out);
    console.log(`${t.file}  ${Math.round(info.size / 1024)} KB  ← ${url}`);
  } catch (e) {
    failed++;
    console.error(`失敗: ${t.id} (${url}): ${e.message}`);
  } finally {
    await send('Target.closeTarget', { targetId });
  }
}

ws.close();
chrome.kill();
await new Promise((r) => chrome.once('exit', r));
rmSync(profile, { recursive: true, force: true });
console.log(`${targets.length - failed} / ${targets.length} 枚を書き出しました。目で見て、読み込み途中のものは --only で撮り直してください`);
process.exit(failed ? 1 : 0);
