import { MODULES } from './registry.generated';
import type { Panel } from './types';

// 右パネルのタブ。panels/ のファイルが書き出す Panel を集め、order の小さい順に並べる
// （order の無いものは後ろ、その中は id 順）。一覧は scripts/gen-registries.mjs が作るので、
// 新しいタブは panels/<名前>Panel.tsx を足すだけでよい。ここは書き換えない。
const isPanel = (v: unknown): v is Panel =>
  !!v &&
  typeof v === 'object' &&
  typeof (v as Panel).id === 'string' &&
  typeof (v as Panel).available === 'function' &&
  'Component' in v;

const orderOf = (p: Panel) => p.order ?? Number.MAX_SAFE_INTEGER;

const byOrder = (a: Panel, b: Panel) => orderOf(a) - orderOf(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export const PANELS: Panel[] = MODULES.flatMap((m) => Object.values(m).filter(isPanel)).sort(byOrder);

/** パッケージのタブに、使う側のページが足すタブ（Viewer の panels）を混ぜて並べる。 */
export const withExtraPanels = (extra: Panel[] | undefined): Panel[] =>
  extra?.length ? [...PANELS, ...extra].sort(byOrder) : PANELS;

/** ?tab= に指定できるタブの id。 */
export const PANEL_IDS: string[] = PANELS.map((p) => p.id);
