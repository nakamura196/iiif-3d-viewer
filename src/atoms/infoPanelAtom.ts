import { atom } from 'jotai';
import type { ManifestV4 } from '@/types/iiif';
import type { Annotation, InfoPanelContent, Annotation3 } from '@/types/main';

export const infoPanelAtom = atom<InfoPanelContent | null>(null);

export const manifestAtom = atom<ManifestV4 | null>(null);

export const annotationsAtom = atom<Annotation[]>([]);

export const annotationsAtom3 = atom<Annotation3[]>([]);

// 選択中のアノテーションIDのアトム
export const selectedAnnotationIdAtom = atom<string | null>(null);

export const manifestUrlAtom = atom<string | null>(null);

// アノテーション表示/非表示のアトム
export const showAnnotationsAtom = atom<boolean>(true);
