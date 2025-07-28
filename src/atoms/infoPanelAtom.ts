import { atom } from 'jotai';
import type { Manifest } from '@iiif/presentation-3';
import type { Annotation, InfoPanelContent, Annotation3 } from '@/types/main';

export const infoPanelAtom = atom<InfoPanelContent | null>(null);

export const manifestAtom = atom<Manifest | null>(null);

export const annotationsAtom = atom<Annotation[]>([]);

export const annotationsAtom3 = atom<Annotation3[]>([]);

// 選択中のアノテーションIDのアトム
export const selectedAnnotationIdAtom = atom<string | null>(null);

export const manifestUrlAtom = atom<string | null>(null);
