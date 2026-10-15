// ドメイン移行 (github.io/iiif-3d-viewer・3d-iiif-viewer.vercel.app → 3d.ldas.jp → kasane.ldas.jp) の設定を固定するテスト。
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { LOCALES, OLD_HOSTS, PUBLIC_PATHS, SITE_URL, alternatesFor } from './site';
import robots from '@/app/robots';
import sitemap from '@/app/sitemap';
import { NEWS } from './news';
import { USE_CASES } from './usecases';
import { SAMPLES } from './samples';
import { COOKBOOK_RECIPES } from './cookbookRecipes';

const root = join(__dirname, '../..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

describe('公開 URL', () => {
  it('kasane.ldas.jp', () => {
    expect(SITE_URL).toBe('https://kasane.ldas.jp');
  });

  it('canonical はページ自身、言語の組は同じパス', () => {
    expect(alternatesFor('ja', '')).toEqual({ canonical: '/ja/', languages: { ja: '/ja/', en: '/en/' } });
    expect(alternatesFor('en', 'help/')).toEqual({
      canonical: '/en/help/',
      languages: { ja: '/ja/help/', en: '/en/help/' },
    });
  });

  it('下層ページはすべて自分の canonical を持つ', () => {
    for (const p of PUBLIC_PATHS.filter(Boolean)) {
      const src = read(`src/app/[locale]/${p}page.tsx`);
      expect(src).toContain(`alternatesFor(locale, '${p}')`);
    }
  });

  it('robots は sitemap を新ホストで示す', () => {
    expect(robots().sitemap).toBe('https://kasane.ldas.jp/sitemap.xml');
  });

  it('sitemap は全ロケール×全ページ、新ホストで、ページは実在する', () => {
    const urls = sitemap().map((e) => e.url);
    expect(urls).toHaveLength(LOCALES.length * (PUBLIC_PATHS.length + NEWS.length + USE_CASES.length + SAMPLES.length + COOKBOOK_RECIPES.length));
    expect(urls).toContain('https://kasane.ldas.jp/ja/');
    expect(urls).toContain('https://kasane.ldas.jp/en/viewer/');
    expect(urls).toContain(`https://kasane.ldas.jp/ja/news/${NEWS[0].id}/`);
    // ユースケース・サンプルの詳細ページも載る
    expect(urls).toContain('https://kasane.ldas.jp/ja/usecases/kuniezu/');
    expect(urls).toContain(`https://kasane.ldas.jp/en/samples/kasane/${SAMPLES[0].id}/`);
    expect(urls).toContain(`https://kasane.ldas.jp/ja/samples/${COOKBOOK_RECIPES[0].id}/`);
    for (const p of PUBLIC_PATHS) {
      expect(existsSync(join(root, 'src/app/[locale]', p, 'page.tsx'))).toBe(true);
    }
  });
});

describe('旧 3d.ldas.jp・vercel.app の転送', () => {
  const vercel = JSON.parse(read('vercel.json'));
  it('全パス (トップを含む) を同じパスのまま kasane.ldas.jp へ恒久転送', () => {
    // `/:path*` だとトップ (/) に当たらない (kotenocr で実測)。`/:rest(.*)` を使う
    expect(vercel.redirects).toEqual([
      { source: '/:rest(.*)', destination: 'https://kasane.ldas.jp/:rest', permanent: true },
    ]);
  });
  it('JS が動かないときの予備ページも kasane.ldas.jp を指す', () => {
    const html = read('vercel-static/index.html');
    expect(html).toContain("'https://kasane.ldas.jp/'");
    expect(html).toContain('url=https://kasane.ldas.jp/');
  });
});

describe('Pages はホスト直下で配る', () => {
  it('配布するビルドは basePath を付けない (GITHUB_PAGES を立てない)', () => {
    const wf = read('.github/workflows/deploy-pages.yml');
    const step = wf.split('- name: Build static export')[1]?.split('- name:')[0];
    expect(step).toBeTruthy();
    expect(step).not.toMatch(/GITHUB_PAGES/);
    // 配布される out/ はこのステップで作り直したもの (サブパスの検査用ビルドは消してある)
    expect(wf).toMatch(/check-basepath\.sh[\s\S]*rm -rf out \.next[\s\S]*- name: Build static export/);
  });
  it('PWA の manifest はホスト直下', () => {
    const m = JSON.parse(read('public/manifest.json'));
    expect([m.scope, m.start_url]).toEqual(['/', '/']);
  });
});

describe('旧ホストの文字列が残っていない', () => {
  const files: string[] = [];
  const walk = (d: string) => {
    for (const n of readdirSync(d)) {
      const f = join(d, n);
      if (statSync(f).isDirectory()) walk(f);
      else if (/\.(tsx?|jsx?|json|md|html)$/.test(n)) files.push(f);
    }
  };
  for (const d of ['src', 'public', 'docs', 'vercel-static']) walk(join(root, d));
  files.push(join(root, 'README.md'));

  it.each(OLD_HOSTS)('%s', (host) => {
    const hits = files.filter(
      (f) => !/site(\.test)?\.ts$/.test(f) && readFileSync(f, 'utf8').includes(host),
    );
    expect(hits).toEqual([]);
  });
});
