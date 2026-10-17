import { PANEL_IDS } from '@nakamura196/iiif-viewer';

// /viewer の ?tab= に指定できるタブ。ViewerContent が URL を読むときと、
// ユースケース・サンプルが「開いたあとに選ぶタブ」を書くときの両方で使う。
// 一覧はビューアの右パネル（panels/）から作るので、タブを足してもここは書き換えない。
// サイトが足すタブ（ほかの表示。components/OtherViewsPanel）だけはパッケージの外にあるので、ここで加える。
export const OTHER_VIEWS_TAB = 'views';

export const VIEWER_TABS: readonly string[] = [...PANEL_IDS, OTHER_VIEWS_TAB];

export type ViewerTab = string;

export const isViewerTab = (v: string | null | undefined): v is ViewerTab => !!v && VIEWER_TABS.includes(v);
