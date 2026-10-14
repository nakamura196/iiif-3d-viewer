'use client';

import AnnotationList from '../annotation/AnnotationList';
import type { Panel } from './types';

// 3D の Scene のアノテーション一覧。container を渡さない使い方（比較ページ）でも出す。
export const annotationsPanel: Panel = {
  id: 'annotations',

  order: 90,
  available: ({ container }) => !container || container.kind === 'Scene',
  Component: () => <AnnotationList />,
};
