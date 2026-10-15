'use client';

import AnnotationList from '../annotation/AnnotationList';
import type { Panel } from './types';

// 3D の Scene のアノテーション一覧。container を渡さない使い方（比較ページ）では、
// アノテーションが 1 件以上あるときだけ出す（画像どうしの比較では空のタブになるため）。
export const annotationsPanel: Panel = {
  id: 'annotations',

  order: 90,
  available: ({ container, annotationCount }) =>
    container ? container.kind === 'Scene' : (annotationCount ?? 0) > 0,
  Component: () => <AnnotationList />,
};
