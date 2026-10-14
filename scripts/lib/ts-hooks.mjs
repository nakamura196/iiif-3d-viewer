// Node から src/ の TypeScript（@/ の別名つき・拡張子なしの import）を読むためのフック。
// 別名と拡張子を補い、型は Node の stripTypeScriptTypes で取り除く。
// Node が標準で行う型の取り除き（strip-only）は、コンストラクタの引数に public を付ける書き方などを
// 読めないので、書き換えも行う transform の方を使う
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const SRC = fileURLToPath(new URL('../../src/', import.meta.url));

const isFile = (f) => statSync(f, { throwIfNoEntry: false })?.isFile() ?? false;
const withTsExtension = (file) =>
  [file, `${file}.ts`, `${file}.tsx`, path.join(file, 'index.ts')].find(isFile);

registerHooks({
  resolve(specifier, context, next) {
    let file;
    if (specifier.startsWith('@/')) file = path.join(SRC, specifier.slice(2));
    else if (specifier.startsWith('.') && context.parentURL?.match(/\.tsx?$/))
      file = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
    if (file) {
      const found = withTsExtension(file);
      if (found) return next(pathToFileURL(found).href, context);
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (!/\.ts$/.test(url)) return next(url, context);
    const source = stripTypeScriptTypes(readFileSync(fileURLToPath(url), 'utf8'), { mode: 'transform' });
    return { format: 'module', source, shortCircuit: true };
  },
});
