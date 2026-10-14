// 機能の一覧（右パネルのタブ・画像に重ねる表示・読み取り・文言）を、置いてあるファイルから作る。
// 機能を足すときに共有の一覧を書き換えずに済むので、並行して作業しても一覧でぶつからない。
//
// 作るファイル（*.generated.ts。git には入れない）:
// - packages/iiif-viewer/src/react/panels/registry.generated.ts   panels/*.tsx をすべて読み込む
// - packages/iiif-viewer/src/react/overlays/registry.generated.ts overlays/*.tsx をすべて読み込む
// - packages/iiif-viewer/src/core/features/index.generated.ts      core/features/*.ts と、index.ts のあるフォルダ
// - packages/iiif-viewer/src/react/messages/features.generated.ts  messages/features/*.{ja,en}.json
//
// next.config.mjs・vitest.config.ts・packages/iiif-viewer/vite.config.ts が読み込み時に呼ぶ。
// 手で走らせるときは `npm run gen`。中身が変わらなければ書き込まない（開発サーバの再読み込みを起こさない）。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'packages/iiif-viewer/src');

const HEADER = '// 自動生成（scripts/gen-registries.mjs）。手で直さない。git には入れない。\n';

const isTest = (f) => /\.test\.tsx?$/.test(f);
const isGenerated = (f) => f.includes('.generated.');
const byName = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

const listFiles = (dir, ext) =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(ext) && !isTest(e.name) && !isGenerated(e.name))
    .map((e) => e.name)
    .sort(byName);

// フォルダ内の部品をすべて読み込み、MODULES として渡す。どれが部品かは registry.ts が形で見分ける。
const modulesFile = (dir) => {
  const names = listFiles(dir, '.tsx').map((f) => f.slice(0, -'.tsx'.length));
  const imports = names.map((n, i) => `import * as m${i} from './${n}';`).join('\n');
  const list = names.map((_, i) => `m${i}`).join(', ');
  return `${HEADER}${imports}\n\nexport const MODULES: Record<string, unknown>[] = [${list}];\n`;
};

// 読み取りの機能: 1 機能 1 ファイル（<機能>.ts）か、1 機能 1 フォルダ（<機能>/index.ts）。
// 名前が _ で始まるものと index.ts は除く。
const featuresFile = (dir) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const names = [
    ...entries
      .filter((e) => e.isFile() && e.name.endsWith('.ts') && !isTest(e.name) && !isGenerated(e.name))
      .map((e) => e.name.slice(0, -'.ts'.length))
      .filter((n) => n !== 'index' && !n.startsWith('_')),
    ...entries
      .filter((e) => e.isDirectory() && !e.name.startsWith('_') && fs.existsSync(path.join(dir, e.name, 'index.ts')))
      .map((e) => e.name),
  ].sort(byName);
  return `${HEADER}${names.map((n) => `export * from './${n}';`).join('\n')}\n`;
};

// 文言: features/<機能>.ja.json と <機能>.en.json の組。
const messagesFile = (dir) => {
  const files = listFiles(path.join(dir, 'features'), '.json');
  const ident = (f) => f.replace(/\.json$/, '').replace(/[^A-Za-z0-9]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''));
  const imports = files.map((f) => `import ${ident(f)} from './features/${f}';`).join('\n');
  const of = (lang) => files.filter((f) => f.endsWith(`.${lang}.json`)).map(ident).join(', ');
  return `${HEADER}${imports}\n\nexport const FEATURE_MESSAGES = {\n  ja: [${of('ja')}],\n  en: [${of('en')}],\n};\n`;
};

const TARGETS = [
  { dir: path.join(SRC, 'react/panels'), out: 'registry.generated.ts', make: modulesFile },
  { dir: path.join(SRC, 'react/overlays'), out: 'registry.generated.ts', make: modulesFile },
  { dir: path.join(SRC, 'core/features'), out: 'index.generated.ts', make: featuresFile },
  { dir: path.join(SRC, 'react/messages'), out: 'features.generated.ts', make: messagesFile },
];

const writeIfChanged = (file, text) => {
  const old = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  if (old === text) return false;
  fs.writeFileSync(file, text);
  return true;
};

export const generateRegistries = () => {
  const written = [];
  for (const t of TARGETS) {
    const file = path.join(t.dir, t.out);
    if (writeIfChanged(file, t.make(t.dir))) written.push(path.relative(ROOT, file));
  }
  return written;
};

// 開発サーバの起動中にファイルが足されたら、作り直す。
export const watchRegistries = () => {
  let timer;
  for (const t of TARGETS) {
    fs.watch(t.dir, { recursive: true }, (_, name) => {
      if (name && isGenerated(String(name))) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        const written = generateRegistries();
        if (written.length) console.log(`[gen-registries] ${written.join(', ')}`);
      }, 100);
    });
  }
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const written = generateRegistries();
  console.log(written.length ? `[gen-registries] ${written.join(', ')}` : '[gen-registries] 変更なし');
}
