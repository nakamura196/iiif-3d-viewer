import { atom } from 'jotai';

// 右パネルの一覧と、画像の上の印で共有する「選ばれている注釈」。Viewer ごとの store に載る。
export const selectedCanvasAnnotationAtom = atom<string | null>(null);

// 閲覧者の手元で作った AnnotationPage（ブラウザ内の推論の結果など）。マニフェストには無いが、
// マニフェストの注釈と同じく、右パネルの一覧と画像の上の印に出す。Canvas ごとに、作った側の id で持つ。
export interface LocalAnnotationPage {
  /** Who made it (for example `inference:<model id>`). One page per maker and Canvas. */
  source: string;
  canvasId: string;
  page: unknown;
}

export const localAnnotationPagesAtom = atom<LocalAnnotationPage[]>([]);
