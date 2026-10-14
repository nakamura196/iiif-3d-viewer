import { MODULES } from './registry.generated';
import type { Overlay } from './types';

// 画像に重ねるもの。overlays/ のファイルが書き出す Overlay を集め、order の小さい順に重ねる
// （order の無いものは後ろ、その中は id 順）。一覧は scripts/gen-registries.mjs が作るので、
// 新しい重ね表示は overlays/<名前>Overlay.tsx を足すだけでよい。ここは書き換えない。
const isOverlay = (v: unknown): v is Overlay =>
  !!v &&
  typeof v === 'object' &&
  typeof (v as Overlay).id === 'string' &&
  typeof (v as Overlay).available === 'function' &&
  'Component' in v;

const orderOf = (o: Overlay) => o.order ?? Number.MAX_SAFE_INTEGER;

export const OVERLAYS: Overlay[] = MODULES.flatMap((m) => Object.values(m).filter(isOverlay)).sort(
  (a, b) => orderOf(a) - orderOf(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
);
