'use client';

import { useState } from 'react';
import { atom, useAtom } from 'jotai';
import { buildTicks, rulerGeometry, type DisplayUnit, type Physdim } from '../../core';
import { useTranslations } from '../env';
import type { StageInfo } from './ImageView';

// 実寸の物差し（IIIF physdim service）。画像の上端と左端に、画面の大きさのまま目盛りを描く。
// 画像（ステージ）の外に置くので、拡大しても太さと文字の大きさは変わらない。目盛りの間隔だけが変わる。

interface RulerSettings {
  fontSize: number;
  tickSize: number;
  color: string;
  opacity: number;
  unit: DisplayUnit;
}

const DEFAULTS: RulerSettings = { fontSize: 12, tickSize: 14, color: '#ffffff', opacity: 0.7, unit: 'cm' };

// 画面を開いている間だけ覚える。別の Canvas に移っても同じ設定
const settingsAtom = atom<RulerSettings>(DEFAULTS);
const visibleAtom = atom(true);

const THICK = 28; // 定規の帯の太さ（CSS px）

const UNITS: DisplayUnit[] = ['mm', 'cm', 'in'];

export default function PhysicalRuler({
  physdim,
  canvasWidth,
  canvasHeight,
  stage,
}: {
  physdim: Physdim;
  canvasWidth: number;
  canvasHeight: number;
  stage: StageInfo;
}) {
  const t = useTranslations('Viewer');
  const [s, setS] = useAtom(settingsAtom);
  const [visible, setVisible] = useAtom(visibleAtom);
  const [open, setOpen] = useState(false);
  // ドラッグやホイールが下の画像に届かないようにする
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  if (!visible) {
    return (
      <button
        type="button"
        className="absolute top-1 left-1 z-20 text-xs rounded border border-[var(--ds-border)] bg-[var(--ds-surface)] text-[var(--ds-fg)] px-2 py-1"
        onPointerDown={stop}
        onDoubleClick={stop}
        onClick={() => setVisible(true)}
      >
        {t('rulerShow')}
      </button>
    );
  }

  const g = rulerGeometry(physdim, s.unit, { w: canvasWidth, h: canvasHeight }, stage);
  const h = buildTicks(g.lengthX, g.pixelsPerUnit, g.originX, stage.boxW, THICK);
  const v = buildTicks(g.lengthY, g.pixelsPerUnit, g.originY, stage.boxH, THICK);
  const bg = `rgba(0,0,0,${s.opacity})`;
  const long = s.tickSize;
  const short = Math.round(s.tickSize / 2);
  const text = { fill: s.color, fontSize: s.fontSize, fontWeight: 'bold', stroke: 'rgba(0,0,0,0.6)', strokeWidth: 3, paintOrder: 'stroke' } as const;

  return (
    <>
      <svg
        className="absolute inset-0 z-10 pointer-events-none"
        width={stage.boxW}
        height={stage.boxH}
        style={{ fontFamily: 'monospace' }}
        data-physical-ruler
      >
        <rect x={THICK} y={0} width={Math.max(0, stage.boxW - THICK)} height={THICK} fill={bg} />
        <rect x={0} y={THICK} width={THICK} height={Math.max(0, stage.boxH - THICK)} fill={bg} />
        <rect x={0} y={0} width={THICK} height={THICK} fill={bg} />
        {h.ticks.map((k) => (
          <g key={`h${k.pos}`}>
            <line x1={k.px} y1={THICK} x2={k.px} y2={THICK - (k.major ? long : short)} stroke={s.color} />
            {k.major && (
              <text x={k.px + 3} y={THICK - 5} {...text} data-ruler-label="h">
                {k.label}
              </text>
            )}
          </g>
        ))}
        {v.ticks.map((k) => (
          <g key={`v${k.pos}`}>
            <line x1={THICK} y1={k.px} x2={THICK - (k.major ? long : short)} y2={k.px} stroke={s.color} />
            {k.major && (
              <text transform={`translate(${THICK - long + s.fontSize}, ${k.px - 3}) rotate(-90)`} {...text} data-ruler-label="v">
                {k.label}
              </text>
            )}
          </g>
        ))}
        <text x={3} y={THICK + s.fontSize + 2} {...text} fontSize={s.fontSize} data-ruler-unit>
          {s.unit}
        </text>
      </svg>
      <button
        type="button"
        aria-label={t('rulerSettings')}
        title={t('rulerSettings')}
        className="absolute top-0 left-0 z-20 grid place-items-center text-[var(--ds-fg)] bg-[var(--ds-surface)] border border-[var(--ds-border)]"
        style={{ width: THICK, height: THICK }}
        onPointerDown={stop}
        onDoubleClick={stop}
        onClick={() => setOpen((o) => !o)}
      >
        <span aria-hidden>⚙</span>
      </button>
      {open && (
        <div
          className="absolute z-20 text-sm text-[var(--ds-fg)] bg-[var(--ds-surface)] border border-[var(--ds-border)] rounded p-3 shadow flex flex-col gap-2"
          style={{ top: THICK + 4, left: 4, minWidth: 200 }}
          onPointerDown={stop}
          onWheel={stop}
          onDoubleClick={stop}
        >
          <Row label={t('rulerFontSize')}>
            <input type="number" min={8} max={32} value={s.fontSize} className={INPUT} onChange={(e) => setS({ ...s, fontSize: clamp(+e.target.value, 8, 32) })} />
          </Row>
          <Row label={t('rulerTickSize')}>
            <input type="number" min={6} max={26} value={s.tickSize} className={INPUT} onChange={(e) => setS({ ...s, tickSize: clamp(+e.target.value, 6, 26) })} />
          </Row>
          <Row label={t('rulerColor')}>
            <input type="color" value={s.color} onChange={(e) => setS({ ...s, color: e.target.value })} />
          </Row>
          <Row label={t('rulerOpacity')}>
            <input type="range" min={0} max={1} step={0.05} value={s.opacity} onChange={(e) => setS({ ...s, opacity: +e.target.value })} />
          </Row>
          <Row label={t('rulerUnit')}>
            <select value={s.unit} className={INPUT} onChange={(e) => setS({ ...s, unit: e.target.value as DisplayUnit })}>
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </Row>
          <button
            type="button"
            className="text-xs rounded border border-[var(--ds-border)] px-2 py-1 self-end"
            onClick={() => {
              setOpen(false);
              setVisible(false);
            }}
          >
            {t('rulerHide')}
          </button>
        </div>
      )}
    </>
  );
}

const INPUT = 'w-20 text-sm rounded border border-[var(--ds-border)] bg-[var(--ds-surface)] text-[var(--ds-fg)] px-1 py-0.5';
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : lo));

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="whitespace-nowrap">{label}</span>
      {children}
    </label>
  );
}
