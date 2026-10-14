import { atom } from 'jotai';

// ストーリー（右パネルのタブ）と、画像の上の注釈の枠で共有する状態。Viewer ごとの store に載る。

/** The story tab is open: the picture is read scene by scene, so the marks of the annotations step back. */
export const storyOpenAtom = atom<boolean>(false);

/** Show the frame of the current scene (only that one, a thin line without fill). */
export const storyFrameAtom = atom<boolean>(false);
