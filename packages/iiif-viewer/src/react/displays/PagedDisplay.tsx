'use client';

import { useEffect, useRef, useState } from 'react';
import { useAtomValue } from 'jotai';
import type { ContainerInfo } from '../../core';
import { labelIn } from '../../core';
import { useLocale } from '../env';
import { usePlayback } from '../playback';
import { flatDisplay } from './FlatDisplay';
import { focusAtom, usePageOrder } from './structureState';
import type { Display, DisplayProps } from './types';

const imageOf = (c: ContainerInfo | undefined): { url: string } | null => {
  const o = c?.painting.flatMap((p) => p.options).find((x) => x.kind === 'Image');
  return o ? { url: o.url } : null;
};

// A page image in a spread or a continuous strip.
function PageImage({
  container,
  align,
  vertical,
  active,
  onClick,
}: {
  container: ContainerInfo;
  align?: 'left' | 'right';
  vertical?: boolean;
  active?: boolean;
  onClick?: () => void;
}) {
  const locale = useLocale();
  const img = imageOf(container);
  if (!img) return null;
  const ratio = container.width && container.height ? `${container.width} / ${container.height}` : undefined;
  const base = vertical ? 'w-full h-auto' : 'h-full w-auto';
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={img.url}
      alt={labelIn(container.label, locale)}
      loading="lazy"
      draggable={false}
      onClick={onClick}
      data-canvas-id={container.id}
      style={ratio ? { aspectRatio: ratio } : undefined}
      className={`${base} object-contain ${onClick ? 'cursor-pointer' : ''} ${
        active ? 'ring-2 ring-blue-500' : ''
      } ${align === 'left' ? 'ml-auto' : align === 'right' ? 'mr-auto' : ''}`}
    />
  );
}

// Facing pages: the order of the two pages follows the viewing direction.
function Spread({ pages, direction }: { pages: ContainerInfo[]; direction: string }) {
  const vertical = direction === 'top-to-bottom' || direction === 'bottom-to-top';
  const reversed = direction === 'right-to-left' || direction === 'bottom-to-top';
  const shown = reversed ? [...pages].reverse() : pages;
  return (
    <div
      className={`flex-1 min-h-0 min-w-0 flex ${vertical ? 'flex-col' : 'flex-row'} items-stretch justify-center overflow-hidden`}
    >
      {shown.map((c, i) => (
        <div key={c.id} className="flex-1 min-h-0 min-w-0 flex">
          <PageImage
            container={c}
            vertical={vertical}
            align={vertical ? undefined : i === 0 ? 'left' : 'right'}
          />
        </div>
      ))}
    </div>
  );
}

// behavior: continuous — the Canvases are one long strip, in the viewing direction.
function Strip({
  containers,
  order,
  selected,
  direction,
  onSelect,
}: {
  containers: ContainerInfo[];
  order: number[];
  selected: number;
  direction: string;
  onSelect: (index: number) => void;
}) {
  const vertical = direction === 'top-to-bottom' || direction === 'bottom-to-top';
  const reversed = direction === 'right-to-left' || direction === 'bottom-to-top';
  const list = reversed ? [...order].reverse() : order;
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    box.current
      ?.querySelector<HTMLElement>('[data-active="true"]')
      ?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [selected]);
  return (
    <div
      ref={box}
      className={`flex-1 min-h-0 min-w-0 overflow-auto flex ${vertical ? 'flex-col items-center' : 'flex-row'}`}
    >
      {list.map((i) => (
        <div
          key={containers[i].id}
          data-active={i === selected}
          className={vertical ? 'w-full shrink-0' : 'h-full shrink-0'}
        >
          <PageImage container={containers[i]} vertical={vertical} active={i === selected} onClick={() => onSelect(i)} />
        </div>
      ))}
    </div>
  );
}

// Draws the region that a content state / table of contents entry points to, over the image.
// The image element is measured every frame, so the box follows zooming and moving.
function RegionHighlight({ host, container }: { host: React.RefObject<HTMLDivElement | null>; container: ContainerInfo }) {
  const focus = useAtomValue(focusAtom);
  const xywh = focus && focus.target.canvasId === container.id ? focus.target.xywh : undefined;
  const [box, setBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const cw = container.width;
  const ch = container.height;

  useEffect(() => {
    if (!xywh || !cw || !ch) return;
    let frame = 0;
    const tick = () => {
      const root = host.current;
      const img =
        root?.querySelector(`img[data-canvas-id="${CSS.escape(container.id)}"]`) ?? root?.querySelector('img');
      if (root && img) {
        const r = root.getBoundingClientRect();
        const i = img.getBoundingClientRect();
        if (i.width > 0 && i.height > 0) {
          const next = {
            left: i.left - r.left + (xywh[0] / cw) * i.width,
            top: i.top - r.top + (xywh[1] / ch) * i.height,
            width: (xywh[2] / cw) * i.width,
            height: (xywh[3] / ch) * i.height,
          };
          setBox((b) =>
            b && Math.abs(b.left - next.left) < 0.5 && Math.abs(b.top - next.top) < 0.5 && Math.abs(b.width - next.width) < 0.5 && Math.abs(b.height - next.height) < 0.5
              ? b
              : next,
          );
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [xywh, cw, ch, host, container.id]);

  if (!xywh || !box) return null;
  return (
    <div
      data-testid="region-highlight"
      className="absolute pointer-events-none border-2 border-yellow-400 bg-yellow-300/25 shadow-[0_0_0_9999px_rgba(0,0,0,0.25)]"
      style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
    />
  );
}

// Seeks to the time that a content state / table of contents entry points to, once the
// media element of the Canvas exists.
function useSeekOnFocus(container: ContainerInfo) {
  const focus = useAtomValue(focusAtom);
  const { seek, mediaRef } = usePlayback();
  const done = useRef(0);
  const time = focus && focus.target.canvasId === container.id ? focus.target.t?.[0] : undefined;
  const seq = focus?.seq ?? 0;
  useEffect(() => {
    if (time === undefined || done.current === seq) return;
    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      if (mediaRef.current || tries > 30) {
        window.clearInterval(timer);
        done.current = seq;
        seek(time);
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, [time, seq, seek, mediaRef]);
}

// Canvas / Timeline: a single page, facing pages (behavior: paged) or a continuous strip
// (behavior: continuous), in the viewing direction of the manifest. Paging itself is in
// ContainerList; this display decides what the selected page looks like.
function PagedDisplay(props: DisplayProps) {
  const { container, manifest, containers, selectedIndex, select } = props;
  const { viewing, order, groups } = usePageOrder(manifest, containers);
  const host = useRef<HTMLDivElement>(null);
  useSeekOnFocus(container);

  const group = groups.find((g) => g.includes(selectedIndex)) ?? [selectedIndex];
  const pages = group.map((i) => containers[i]).filter((c): c is ContainerInfo => !!c);
  const allImages = pages.length > 1 && pages.every((c) => !!imageOf(c));

  let body: React.ReactNode;
  if (viewing.mode === 'continuous' && containers.length > 1 && containers.every((c) => !!imageOf(c))) {
    body = (
      <Strip
        containers={containers}
        order={order}
        selected={selectedIndex}
        direction={viewing.direction}
        onSelect={select}
      />
    );
  } else if (allImages) {
    body = <Spread pages={pages} direction={viewing.direction} />;
  } else {
    body = <flatDisplay.Component {...props} />;
  }

  return (
    <div ref={host} className="relative flex-1 min-h-0 min-w-0 flex flex-col">
      {body}
      <RegionHighlight host={host} container={container} />
    </div>
  );
}

export const pagedDisplay: Display = {
  id: 'paged',
  // every Canvas / Timeline that FlatDisplay can show goes through here
  match: (c) => c.kind !== 'Scene' && flatDisplay.match(c),
  Component: PagedDisplay,
};
