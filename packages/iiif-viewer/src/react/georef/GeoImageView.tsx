'use client';

import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react';
import {
  clusterExpansionScale,
  clusterLevelScale,
  clusterPoints,
  detailWidthOf,
  imageViewToStage,
  stageToImageView,
  type CanvasImages,
  type GeorefImageView,
  type ImageLayer,
  type PointCluster,
} from '../../core';
import { ImageLayers } from '../displays/ImageTiles';
import ImageView, { homeView, INITIAL_VIEW, maxScaleOf, rotatePoint, type StageInfo, type ViewState } from '../displays/ImageView';

// ジオリファレンスの画面（/georef）で、地点の付いた画像（絵図・古地図）を出す。
// 地点（resourceCoords の x, y）を画像の上に印で出し、印を押すと onSelect を呼ぶ。
// selectedId が変わると、その地点が画面の真ん中に来るよう画像を動かす（地図・一覧からの連動）。
// 拡大率と中心は OpenSeadragon の座標（画像の幅を 1 とする）で受け渡す。URL の zoom・centerX・centerY に使う。
// rotation で画像を回す（反時計回りが正。geo.ldas.jp の rotation と同じ向き）。印と番号は回さずに立てておく。
// clustering のとき、画面の上で近い地点を 1 つの印にまとめて件数を出す。押すと分かれるまで寄り、
// 一番寄っても分かれない（同じ場所の）地点は名前の一覧を出す。選んだ地点はまとめずに上に出す。
// 印は表示枠の座標で、見えている分だけ描く（数千件でも、動かすたびに全部を描き直さない）。

export interface GeoImagePoint {
  id: string;
  title: string;
  /** Canvas 座標。 */
  x: number;
  y: number;
}

export interface GeoImageViewProps {
  canvas: CanvasImages;
  points: GeoImagePoint[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** 開いたときの拡大率と中心。無ければ全体を出す（selectedId があればその地点に寄る）。 */
  initialView?: GeorefImageView;
  /** 拡大・移動するたびに呼ぶ。 */
  onViewChange?: (view: GeorefImageView) => void;
  /** 画像の回転（度、反時計回りが正）。変わると、画面の真ん中を軸に回す。 */
  rotation?: number;
  /** 近い地点を 1 つにまとめて件数を出すか（URL の clustering）。既定は出す。 */
  clustering?: boolean;
}

/** How far to zoom in, at least, when a point is chosen from the map or the list. */
const FOCUS_SCALE = 4;

const MARKER = 14;
/** まとめる距離（画面の px）。 */
const CLUSTER_RADIUS = 40;
/** 表示枠の外でも、これだけ（px）はみ出た印までは描く（端で切れて見えないように）。 */
const CULL_MARGIN = 40;
/** まとまりの印に名前を出す数。 */
const TITLE_MAX = 5;

const countLabel = (n: number) => (n >= 1000 ? `${Number((n / 1000).toFixed(1))}k` : String(n));
// 件数が多いほど大きく（地図のまとまりと同じ段）
const clusterSize = (n: number) => (n < 10 ? 24 : n < 100 ? 30 : n < 1000 ? 36 : 42);

// The view that puts Canvas point (x, y) at the middle of the box.
// The stage is centred in the box and scaled around its centre, so a point at stage offset d
// (from the stage centre) shows at tx + scale * d from the box centre.
// A turned stage (`rotation`, clockwise degrees) shows it at tx + scale * R d.
export const centerOn = (
  stage: StageInfo,
  cw: number,
  ch: number,
  x: number,
  y: number,
  scale: number,
  rotation = 0,
): ViewState => {
  const [dx, dy] = rotatePoint((x / cw - 0.5) * stage.stageW, (y / ch - 0.5) * stage.stageH, rotation);
  return { scale, tx: -scale * dx, ty: -scale * dy, rotation };
};

// 回転を変えたときの表示。全体を出しているときは、回した後の全体が収まるよう縮め直す。
// それ以外は、画面の真ん中に出ている場所を軸に回す（拡大率はそのまま）
const turnView = (v: ViewState, stage: StageInfo, rotation: number): ViewState => {
  const before = v.rotation ?? 0;
  const home = homeView(stage, before);
  const atHome = v.tx === 0 && v.ty === 0 && Math.abs(v.scale - home.scale) < 1e-9;
  if (atHome) return homeView(stage, rotation);
  const [tx, ty] = rotatePoint(v.tx, v.ty, rotation - before);
  return { scale: v.scale, tx, ty, rotation };
};

export default function GeoImageView({
  canvas,
  points,
  selectedId,
  onSelect,
  initialView,
  onViewChange,
  rotation = 0,
  clustering = true,
}: GeoImageViewProps) {
  const [view, setView] = useState<ViewState>(INITIAL_VIEW);
  const stageRef = useRef<StageInfo | null>(null);
  const layers: ImageLayer[] = canvas.paintings.flatMap((p) => p.options[0]?.layer ?? []);
  const width = canvas.width ?? layers[0]?.width;
  const height = canvas.height ?? layers[0]?.height;
  // 開いたときの表示を決め終えたか。決める前は、選択に合わせて動かさず、URL にも書かない
  const [ready, setReady] = useState(false);
  // 最後に寄った地点。開いたときの選択（URL の id）に、後から重ねて寄らないようにする
  const shownIdRef = useRef<string | null>(null);
  // 台の回転（時計回り）。rotation とは向きが逆
  const turn = rotation ? -rotation : 0;
  const startRef = useRef({ initialView, selectedId, points, turn });
  const onViewChangeRef = useRef(onViewChange);
  useEffect(() => {
    startRef.current = { initialView, selectedId, points, turn };
    onViewChangeRef.current = onViewChange;
  });

  // 開いたときの表示。表示枠の大きさは描いてから分かるので、分かるまで（2 秒まで）毎フレーム待つ
  useEffect(() => {
    if (!width || !height) return;
    let frames = 0;
    let raf = 0;
    const tick = () => {
      const stage = stageRef.current;
      if (stage && stage.stageW > 0) {
        const { initialView: iv, selectedId: sel, points: pts, turn: rot } = startRef.current;
        const p = pts.find((pt) => pt.id === sel);
        if (iv) setView(imageViewToStage(iv, stage, width, height, rot));
        else if (p) setView(centerOn(stage, width, height, p.x, p.y, FOCUS_SCALE, rot));
        else setView(homeView(stage, rot));
        shownIdRef.current = sel;
        setReady(true);
        return;
      }
      if (++frames < 120) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [width, height]);

  // 地図や一覧で選ばれた地点へ画像を動かす。画像の印を押したときも同じ動きになる。
  useEffect(() => {
    const stage = stageRef.current;
    if (!ready || selectedId === shownIdRef.current) return;
    const p = points.find((pt) => pt.id === selectedId);
    if (!stage || !p || !width || !height || stage.stageW === 0) return;
    shownIdRef.current = selectedId;
    setView((v) => centerOn(stage, width, height, p.x, p.y, Math.max(v.scale, FOCUS_SCALE), v.rotation));
  }, [ready, selectedId, points, width, height]);

  // 回転が変わったら回す（スライダー・自動回転・URL）
  useEffect(() => {
    const stage = stageRef.current;
    if (!ready || !stage || stage.stageW === 0) return;
    setView((v) => ((v.rotation ?? 0) === turn ? v : turnView(v, stage, turn)));
  }, [ready, turn]);

  // 拡大率と中心を知らせる（URL に書く）
  useEffect(() => {
    const stage = stageRef.current;
    if (!ready || !stage || stage.stageW === 0 || !width || !height) return;
    onViewChangeRef.current?.(stageToImageView(view, stage, width, height));
  }, [ready, view, width, height]);

  // 同じ場所の地点の一覧（Canvas 座標の位置と、地点の id）
  const [list, setList] = useState<{ x: number; y: number; ids: string[] } | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  // 一覧の外を押したら閉じる
  useEffect(() => {
    if (!list) return;
    const close = (e: globalThis.PointerEvent) => {
      if (!listRef.current?.contains(e.target as Node)) setList(null);
    };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [list]);
  // 拡大の段・地点・選択・切り替えが変わったときだけまとめ直す（移動と回転では数え直さない）
  const clusterCache = useRef<{ key: unknown[]; clusters: PointCluster[] } | null>(null);
  const clustersFor = (unitPx: number, scale: number): PointCluster[] => {
    const level = clustering ? clusterLevelScale(scale) : 0;
    const key = [points, selectedId, clustering, level, unitPx];
    const cached = clusterCache.current;
    if (cached && cached.key.every((k, i) => k === key[i])) return cached.clusters;
    const others = points.filter((p) => p.id !== selectedId);
    const clusters = clustering
      ? clusterPoints(others, unitPx * level, CLUSTER_RADIUS)
      : clusterPoints(others, 1, 0);
    clusterCache.current = { key, clusters };
    return clusters;
  };

  if (!width || !height) return null;
  const maxScale = (stageW: number) => maxScaleOf(detailWidthOf(layers), stageW);
  const titleOf = new Map(points.map((p) => [p.id, p.title]));
  const selectedIndex = points.findIndex((p) => p.id === selectedId);
  const selectedPoint = selectedIndex < 0 ? undefined : points[selectedIndex];

  // 地点の印（表示枠の座標で置く）
  const markers = (stage: StageInfo) => {
    const unitPx = stage.stageW / width;
    const rot = stage.rotation ?? 0;
    // Canvas 座標の点が表示枠のどこに出るか
    const project = (x: number, y: number): [number, number] => {
      const [dx, dy] = rotatePoint((x / width - 0.5) * stage.stageW, (y / height - 0.5) * stage.stageH, rot);
      return [stage.boxW / 2 + stage.tx + stage.scale * dx, stage.boxH / 2 + stage.ty + stage.scale * dy];
    };
    const visible = ([left, top]: [number, number]) =>
      left > -CULL_MARGIN && top > -CULL_MARGIN && left < stage.boxW + CULL_MARGIN && top < stage.boxH + CULL_MARGIN;
    // 押したときに画像のドラッグが始まらないようにする
    const stop = {
      onPointerDown: (e: PointerEvent) => e.stopPropagation(),
      onDoubleClick: (e: MouseEvent) => e.stopPropagation(),
    };
    const openCluster = (c: PointCluster) => {
      const s = clusterExpansionScale(c, unitPx, { w: stage.boxW, h: stage.boxH }, stage.scale, maxScale(stage.stageW), CLUSTER_RADIUS);
      if (s === null) setList({ x: c.x, y: c.y, ids: c.ids });
      else setView(centerOn(stage, width, height, c.x, c.y, s, stage.rotation));
    };

    const items = clustersFor(unitPx, stage.scale).flatMap((c) => {
      const at = project(c.x, c.y);
      if (!visible(at)) return [];
      if (c.ids.length === 1) {
        const id = c.ids[0];
        const title = titleOf.get(id) ?? id;
        return [
          <button
            key={id}
            type="button"
            title={title}
            aria-label={title}
            aria-pressed={false}
            {...stop}
            onClick={() => onSelect(id)}
            className="absolute pointer-events-auto rounded-full border-2 border-white shadow bg-blue-500 hover:bg-blue-600"
            style={{ left: at[0], top: at[1], width: MARKER, height: MARKER, transform: 'translate(-50%, -50%)' }}
          />,
        ];
      }
      const names = c.ids.slice(0, TITLE_MAX).map((id) => titleOf.get(id) ?? id);
      const title = `${names.join('、')}${c.ids.length > TITLE_MAX ? ' …' : ''} (${c.ids.length})`;
      const size = clusterSize(c.ids.length);
      return [
        <button
          key={`cluster:${c.ids[0]}`}
          type="button"
          title={title}
          aria-label={title}
          {...stop}
          onClick={() => openCluster(c)}
          className="absolute pointer-events-auto rounded-full border-[3px] border-white shadow bg-blue-500/90 hover:bg-blue-600 flex items-center justify-center text-xs font-bold text-white"
          style={{ left: at[0], top: at[1], width: size, height: size, transform: 'translate(-50%, -50%)' }}
        >
          {countLabel(c.ids.length)}
        </button>,
      ];
    });

    const selectedAt = selectedPoint ? project(selectedPoint.x, selectedPoint.y) : null;
    const listAt = list ? project(list.x, list.y) : null;
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden" data-georef-marks>
        {items}
        {selectedPoint && selectedAt && visible(selectedAt) && (
          <button
            type="button"
            title={selectedPoint.title}
            aria-label={selectedPoint.title}
            aria-pressed
            {...stop}
            onClick={() => onSelect(selectedPoint.id)}
            className="absolute pointer-events-auto rounded-full border-2 border-white shadow bg-red-500 flex items-center justify-center text-[9px] font-bold text-white"
            style={{ left: selectedAt[0], top: selectedAt[1], width: MARKER * 1.6, height: MARKER * 1.6, transform: 'translate(-50%, -50%)' }}
          >
            {selectedIndex + 1}
          </button>
        )}
        {list && listAt && (
          <ul
            ref={listRef}
            {...stop}
            className="absolute pointer-events-auto max-h-60 w-56 overflow-y-auto rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-lg border border-gray-200 dark:border-gray-700 py-1 text-sm"
            style={{ left: listAt[0] + 14, top: listAt[1] - 14 }}
          >
            {list.ids.map((id) => (
              <li key={id}>
                <button
                  type="button"
                  className="block w-full text-left px-3 py-1 hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={() => {
                    setList(null);
                    onSelect(id);
                  }}
                >
                  {titleOf.get(id) ?? id}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  return (
    <ImageView
      canvasWidth={width}
      canvasHeight={height}
      detailWidth={detailWidthOf(layers)}
      view={view}
      onViewChange={setView}
      over={markers}
    >
      {(stage) => {
        stageRef.current = stage;
        return <ImageLayers layers={layers} canvasWidth={width} canvasHeight={height} stage={stage} />;
      }}
    </ImageView>
  );
}
