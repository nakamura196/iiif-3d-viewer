// vdiff.js (CODH, MIT) を headless Chromium で実際に動かし、自動の対応点探索で得た射影行列を取り出す。
// 前提: 配信用ディレクトリ SRV に vdiff_harness.html (= harness.html), vdiffjs/vdiff.bundle.min.js, vdiffjs/vdiff.bundle.css,
//   opencv/opencv-4.5.1.js (いずれも https://codh.rois.ac.jp/software/vdiffjs/demo/ から取得), img/pNNN_{A,B}_{600,1000}.jpg (fetch_pairs.py) を置く。
//   python3 -m http.server PORT --bind 127.0.0.1 --directory SRV
//   node run_vdiff.mjs PORT OUT.json 1 9 16 ...
// harness は cv.findHomography を包んで、vdiff.js が求めた行列 (画像2 -> 画像1) と対応点を記録する。
import { createRequire } from 'module';
// playwright は本体チェックアウトの node_modules から読む (PLAYWRIGHT_PKG で変更可)
const require = createRequire(process.env.PLAYWRIGHT_PKG || process.env.HOME + '/git/iiif/iiif-kasane/package.json');
const { chromium } = require('playwright');
import fs from 'fs';
const [port, out, ...ids] = process.argv.slice(2);
const res = {};
const browser = await chromium.launch({ headless: true });
for (const w of [600, 1000]) for (const n of ids) {
  for (let rep = 0; rep < 2; rep++) {
    const page = await browser.newPage();
    const p = String(n).padStart(3, '0');
    await page.goto(`http://127.0.0.1:${port}/harness.html?img1=img/p${p}_A_${w}.jpg&img2=img/p${p}_B_${w}.jpg`);
    await page.waitForFunction(() => window.__rec && window.__rec.done, null, { timeout: 120000 });
    const r = await page.evaluate(() => window.__rec);
    (res[`${n}_${w}`] ??= []).push(r);
    if (rep === 0 && w === 600) await page.screenshot({ path: `shot_${p}.png`, fullPage: true });
    await page.close();
    console.log(n, w, rep, r.nmatch, r.inliers, r.err);
  }
}
await browser.close();
fs.writeFileSync(out, JSON.stringify(res));
