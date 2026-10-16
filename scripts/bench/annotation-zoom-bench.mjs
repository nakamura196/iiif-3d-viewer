// Measure one wheel step of zoom on an image with 21,245 annotation marks (Suikeichuzu).
// Usage: node scripts/bench/annotation-zoom-bench.mjs <base-url> <label> [reps]
//   e.g. HEADED=1 node scripts/bench/annotation-zoom-bench.mjs http://localhost:4102 after 3
// HEADED=1 shows the window. Headless, the canvas steps zoomed out took about 100ms instead of about 16ms.
// Each rep opens the page in a fresh context (empty cache), zooms in 10 steps and out 10 steps,
// and writes <label>.json in the current directory. Per step:
//   frame1: wheel -> requestAnimationFrame -> setTimeout(0)
//   frame2: wheel -> requestAnimationFrame inside requestAnimationFrame -> setTimeout(0)
//   loaf / script / render: Long Animation Frames (over 50ms) in the step, in total, in scripts, and in rendering
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const [base, label, repsArg] = process.argv.slice(2);
const reps = Number(repsArg ?? 5);
const headless = process.env.HEADED !== '1';
const manifest = 'https://iiif-annotation-viewer.vercel.app/data/manifest_v3_with_metadata.json';
const url = `${base}/ja/viewer/?manifest=${encodeURIComponent(manifest)}&tab=canvasAnnotations`;

const browser = await chromium.launch({ headless });
const results = [];
for (let rep = 1, tries = 0; rep <= reps; rep++) {
 try {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'load' });
  // 印（DOM か canvas）が出て、タイルの読み込みが落ち着くまで待つ
  await page.waitForFunction(() =>
    document.querySelectorAll('[data-overlay=annotations] [data-annotation-id]').length > 10000 ||
    document.querySelector('[data-annotation-canvas]'), null, { timeout: 120_000 });
  await page.waitForTimeout(8000);
  const steps = await page.evaluate(async () => {
    const stage = document.querySelector('[data-iiif-stage]');
    const box = stage.parentElement;
    const r = box.getBoundingClientRect();
    let loaf = [];
    new PerformanceObserver((l) => loaf.push(...l.getEntries())).observe({ type: 'long-animation-frame' });
    const out = [];
    for (const [dir, dy] of [['in', -300], ['out', 300]]) {
      for (let i = 0; i < 10; i++) {
        loaf = [];
        const t0 = performance.now();
        box.dispatchEvent(new WheelEvent('wheel', { deltaY: dy, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, bubbles: true, cancelable: true }));
        const [frame1, frame2] = await new Promise((res) => requestAnimationFrame(() => {
          let f1;
          setTimeout(() => { f1 = performance.now() - t0; }, 0);
          requestAnimationFrame(() => setTimeout(() => res([f1, performance.now() - t0]), 0));
        }));
        await new Promise((res) => setTimeout(res, 500));
        out.push({
          dir, step: i + 1,
          scale: +(+getComputedStyle(stage).getPropertyValue('--image-scale')).toFixed(2),
          dom: document.querySelectorAll('[data-overlay=annotations] [data-annotation-id]').length,
          canvas: !!document.querySelector('[data-annotation-canvas]'),
          frame1: +frame1.toFixed(1), frame2: +frame2.toFixed(1),
          loaf: Math.round(loaf.filter((e) => e.startTime < t0 + 500).reduce((s, e) => s + e.duration, 0)),
          // LoAF の内訳: スクリプト（React の再描画など）と、描画（スタイル計算・レイアウト・塗り）
          script: Math.round(loaf.filter((e) => e.startTime < t0 + 500).reduce((s, e) => s + e.scripts.reduce((a, x) => a + x.duration, 0), 0)),
          render: Math.round(loaf.filter((e) => e.startTime < t0 + 500).reduce((s, e) => s + (e.renderStart ? e.startTime + e.duration - e.renderStart : 0), 0)),
        });
      }
    }
    return out;
  });
  for (const s of steps) results.push({ label, rep, ...s });
  console.log(label, 'rep', rep, steps.map((s) => `${s.dir}${s.step}:${s.frame2}`).join(' '));
  await ctx.close();
 } catch (e) {
  console.log(label, 'rep', rep, 'failed:', e.name);
  if (++tries > 2) throw e;
  rep--;
 }
}
await browser.close();
writeFileSync(`${label}.json`, JSON.stringify(results, null, 1));
