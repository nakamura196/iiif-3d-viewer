import { atom } from 'jotai';

// 右パネルの一覧と、画像の上の印で共有する「選ばれている注釈」。Viewer ごとの store に載る。
export const selectedCanvasAnnotationAtom = atom<string | null>(null);
