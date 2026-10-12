import { collectionDisplay } from './CollectionDisplay';
import { compositeDisplay } from './CompositeDisplay';
import { flatDisplay } from './FlatDisplay';
import { imageCanvasDisplay } from './ImageCanvasDisplay';
import { pagedDisplay } from './PagedDisplay';
import { sceneDisplay } from './SceneDisplay';
import type { Display } from './types';

// 上にあるものが先に当たる。専用の表示（ページ送り・合成など）は、flatDisplay より前に 1 行足す。
// - collection: Collection（マニフェストの一覧）
// - composite: 1 つの Canvas に、時間でつながる複数のメディア
// - paged: Canvas / Timeline（ページ送り・見開き。1 枚だけのときは imageCanvas に任せる）
// - imageCanvas: 画像の深いズーム・回転・重ね表示など。画像以外は、次に当たる表示に任せる
// - scene: 3D のモデル
export const DISPLAYS: Display[] = [
  collectionDisplay,
  compositeDisplay,
  pagedDisplay,
  imageCanvasDisplay,
  sceneDisplay,
  flatDisplay,
];
