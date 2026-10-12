import type { ComponentType } from 'react';
import type { ContainerInfo, ManifestV4 } from '../../core';

// 右パネルのタブ 1 つ分の契約。新しいタブは、このファイルの型で 1 ファイルを足し、
// panels/registry.ts の一覧に 1 行足す。文言は messages/features/<機能>.{ja,en}.json の Info.<id> に書く。
export interface PanelContext {
  container?: ContainerInfo;
  manifest?: ManifestV4 | null;
}

export interface Panel {
  id: string;
  /** Whether the tab is shown for this container. */
  available: (ctx: PanelContext) => boolean;
  Component: ComponentType<PanelContext>;
}
