// Measure how /georef copes with many points (map markers and image marks).
// Usage: node scripts/bench/georef-bench.mjs <base-url> <n>...   e.g. http://localhost:3871 27 1000 5000
// CLUSTERING=false opens the page with clustering=false (every point on its own).
// Manifests come from scripts/bench/make-georef-manifest.py (public/manifests/bench-georef-<n>.json).
import { chromium } from 'playwright';

const [base, ...counts] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

// Frame gaps and long tasks while `act` runs and for `ms` after it
const measure = async (page, act, ms = 1500) => {
  await page.evaluate(() => {
    window.__gaps = [];
    window.__long = [];
    let last = performance.now();
    window.__run = true;
    const tick = (t) => {
      window.__gaps.push(t - last);
      last = t;
      if (window.__run) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    window.__obs = new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__long.push(e.duration)));
    window.__obs.observe({ type: 'longtask' });
  });
  await act();
  await page.waitForTimeout(ms);
  return page.evaluate(() => {
    window.__run = false;
    window.__obs.disconnect();
    const g = window.__gaps.slice(1).sort((a, b) => a - b);
    const sum = window.__long.reduce((a, b) => a + b, 0);
    return {
      worstFrame: Math.round(g[g.length - 1] ?? 0),
      p90Frame: Math.round(g[Math.floor(g.length * 0.9)] ?? 0),
      longTaskMs: Math.round(sum),
    };
  });
};

for (const n of counts) {
  const manifest = n === '27' ? 'geo-hongo-buildings.json' : `bench-georef-${n}.json`;
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const off = process.env.CLUSTERING === 'false' ? '&clustering=false' : '';
  const url = `${base}/ja/georef?iiif-content=${encodeURIComponent(`${base}/manifests/${manifest}`)}${off}`;
  const t0 = Date.now();
  await page.goto(url);
  // Loaded when the image marks are on the page and the map has drawn its point layer.
  // The map draws points on its canvas (no element per point), so the page marks when the layer is there
  await page.waitForFunction(
    () => document.querySelector('[data-georef-marks] button') && document.querySelector('[data-georef-map-points]'),
    null,
    { timeout: 180000, polling: 200 },
  );
  const loadMs = Date.now() - t0;
  await page.waitForTimeout(2000);

  const mapBox = await page.locator('.maplibregl-canvas').boundingBox();
  const mx = mapBox.x + mapBox.width / 2;
  const my = mapBox.y + mapBox.height / 2;
  const mapPan = await measure(page, async () => {
    await page.mouse.move(mx, my);
    await page.mouse.down();
    for (let i = 1; i <= 20; i++) await page.mouse.move(mx + i * 10, my + i * 5);
    await page.mouse.up();
  });
  const mapZoom = await measure(page, async () => {
    await page.mouse.move(mx, my);
    for (let i = 0; i < 3; i++) await page.mouse.wheel(0, -300);
  });

  // The image view is the box around the marks
  const imgBox = await page.evaluate(() => {
    const r = document.querySelector('[data-georef-marks]').getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
  const ix = imgBox.x + imgBox.width / 2;
  const iy = imgBox.y + imgBox.height / 2;
  const imageZoom = await measure(page, async () => {
    await page.mouse.move(ix, iy);
    for (let i = 0; i < 3; i++) await page.mouse.wheel(0, -300);
  });
  const imagePan = await measure(page, async () => {
    await page.mouse.move(ix, iy);
    await page.mouse.down();
    for (let i = 1; i <= 20; i++) await page.mouse.move(ix + i * 10, iy + i * 5);
    await page.mouse.up();
  });
  console.log(JSON.stringify({ n: Number(n), loadMs, mapPan, mapZoom, imageZoom, imagePan }));
  await page.close();
}
await browser.close();
