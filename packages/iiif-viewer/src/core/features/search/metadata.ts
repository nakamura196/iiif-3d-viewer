// metadata（Presentation 2 でも 3 でも）を、絞り込みに使える「項目名 → 値の一覧」にする。
// 言語の選び方は「この資料について」の表示（about.ts）と同じ、HTML の外し方は注釈の本文（temporal.ts）と同じものを使う。

import { valuesIn } from '../about';
import { plainText } from '../temporal';
import { asList, isObject } from './json';

/** 値を 1 行のふつうの文字にする（HTML を外し、改行と空白を 1 つにまとめる）。 */
const oneLine = (s: string): string => plainText(s, true).replace(/\s+/g, ' ').trim();

/** metadata を、項目名 → 値の一覧にする。空の値と重複は捨てる。 */
export function metadataRecordOf(metadata: unknown, locale: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const entry of asList(metadata)) {
    if (!isObject(entry)) continue;
    const key = oneLine(valuesIn(entry.label, locale).join(' '));
    if (!key) continue;
    for (const v of valuesIn(entry.value, locale).map(oneLine)) {
      if (!v) continue;
      const list = (out[key] ??= []);
      if (!list.includes(v)) list.push(v);
    }
  }
  return out;
}
