// Canvas に重ねて描かれた画像を「レイヤー」として扱う。表示・非表示、不透明度、重ね順。
// 合成（recipe 0036）の画像も、Choice（0033・0326）の候補も、1 枚ずつのレイヤーにする（Mirador の Layers と同じ考え方）。
// Choice の候補は、初めは 1 つ目だけを表示する。読む人が残りを重ねて透かし見られる。

import type { PaintingContent } from '../services/containers';
import type { CanvasPainting, ImageLayer } from './image';

export interface LayerItem {
  /** Unique on the Canvas: the painting id, plus the option number for a Choice. */
  id: string;
  paintingId: string;
  optionIndex: number;
  /** One of the options of a Choice. */
  choice: boolean;
  label: unknown;
  layer: ImageLayer;
}

/** What the reader changed. Absent fields: the default. */
export interface LayerSetting {
  visible?: boolean;
  /** 0 to 1. */
  opacity?: number;
}

/** The image layers of a Canvas, bottom first (painting order: later paintings are drawn on top). */
export const layerItemsOf = (paintings: CanvasPainting[]): LayerItem[] =>
  paintings.flatMap((p) => {
    const choice = p.options.length > 1;
    return p.options.flatMap((o, j) =>
      o.layer
        ? [
            {
              id: choice ? `${p.id}::${j}` : p.id,
              paintingId: p.id,
              optionIndex: j,
              choice,
              label: o.label ?? (choice ? undefined : p.label),
              layer: o.layer,
            },
          ]
        : [],
    );
  });

export const defaultVisible = (item: LayerItem): boolean => !item.choice || item.optionIndex === 0;

export const isLayerVisible = (item: LayerItem, settings: Record<string, LayerSetting>): boolean =>
  settings[item.id]?.visible ?? defaultVisible(item);

export const layerOpacity = (item: LayerItem, settings: Record<string, LayerSetting>): number => {
  const o = settings[item.id]?.opacity;
  return o === undefined || !Number.isFinite(o) ? 1 : Math.min(1, Math.max(0, o));
};

/**
 * The items in the reader's order (bottom first). Ids in `order` come in that order; items it does
 * not name keep their place relative to the default order.
 */
export const orderLayers = (items: LayerItem[], order: string[] | undefined): LayerItem[] => {
  if (!order || order.length === 0) return items;
  const rank = new Map(order.map((id, i) => [id, i]));
  const known = items.filter((it) => rank.has(it.id)).sort((a, b) => rank.get(a.id)! - rank.get(b.id)!);
  let k = 0;
  return items.map((it) => (rank.has(it.id) ? known[k++] : it));
};

/** Moves `id` to position `to` (0 = bottom) in the order of `ids` (bottom first). */
export const moveLayer = (ids: string[], id: string, to: number): string[] => {
  const from = ids.indexOf(id);
  if (from < 0) return ids;
  const out = ids.slice();
  out.splice(from, 1);
  out.splice(Math.max(0, Math.min(out.length, to)), 0, id);
  return out;
};

/** How many images a Canvas can show as layers (decides whether the Layers tab is offered). */
export const imageLayerCount = (painting: PaintingContent[]): number =>
  painting.reduce((n, p) => n + p.options.filter((o) => o.kind === 'Image').length, 0);

// 再生: 重ねた画像を手前から 1 枚ずつ隠し、いちばん奥の 1 枚まで見せていく（起こし絵図をめくる見せ方）。
// 第 k 段では手前の k 枚を隠す。段は 0 から count - 1 まで。

/** The step after `step` in a playback of `count` layers; null when it has ended. */
export const nextPlaybackStep = (step: number, count: number, loop: boolean): number | null =>
  step + 1 < count ? step + 1 : loop && count > 1 ? 0 : null;

/** `settings` with the layers of `ids` (bottom first) shown or hidden as at playback step `step`. */
export const playbackSettings = (
  settings: Record<string, LayerSetting>,
  ids: string[],
  step: number,
): Record<string, LayerSetting> => ({
  ...settings,
  ...Object.fromEntries(ids.map((id, i) => [id, { ...settings[id], visible: i < ids.length - step }])),
});
