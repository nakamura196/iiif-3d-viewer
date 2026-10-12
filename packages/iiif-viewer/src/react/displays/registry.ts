import { flatDisplay } from './FlatDisplay';
import { imageCanvasDisplay } from './ImageCanvasDisplay';
import { sceneDisplay } from './SceneDisplay';
import type { Display } from './types';

// 上にあるものが先に当たる。専用の表示（ページ送り・合成など）は、flatDisplay より前に 1 行足す。
export const DISPLAYS: Display[] = [imageCanvasDisplay, sceneDisplay, flatDisplay];
