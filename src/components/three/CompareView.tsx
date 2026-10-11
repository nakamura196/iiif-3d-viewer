'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, OrbitControls } from '@react-three/drei';
import { Suspense, useCallback, useEffect, useRef, type MutableRefObject } from 'react';
import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsType } from 'three-stdlib';
import Scene, { type PlacedModel, type ViewHandle } from '@/components/three/Scene';

// Two models of one Scene, seen through one camera. Each side has its own canvas;
// whichever the user is moving leads, and the other copies its camera every frame.
// The modes are those of map layer comparison: side by side, a swipe line, and a
// spyglass (a round window showing the other model under the pointer).
export type CompareMode = 'side' | 'swipe' | 'spyglass';

interface SharedCamera {
  leader: number;
  position: THREE.Vector3;
  target: THREE.Vector3;
  fov: number;
  near: number;
  far: number;
  ready: boolean;
}

const LENS_RADIUS = 140; // px

function CameraSync({ index, shared }: { index: number; shared: MutableRefObject<SharedCamera> }) {
  const { camera, controls } = useThree();

  useEffect(() => {
    const c = controls as unknown as OrbitControlsType | null;
    if (!c) return;
    const lead = () => {
      shared.current.leader = index;
    };
    c.addEventListener('start', lead);
    return () => c.removeEventListener('start', lead);
  }, [controls, index, shared]);

  // runs after OrbitControls' own update, so the copied camera is what gets drawn
  useFrame(() => {
    const c = controls as unknown as OrbitControlsType | null;
    if (!c || !(camera instanceof THREE.PerspectiveCamera)) return;
    const s = shared.current;
    if (s.leader === index) {
      s.position.copy(camera.position);
      s.target.copy(c.target);
      s.fov = camera.fov;
      s.near = camera.near;
      s.far = camera.far;
      s.ready = true;
    } else if (s.ready) {
      camera.position.copy(s.position);
      c.target.copy(s.target);
      camera.lookAt(s.target);
      if (camera.fov !== s.fov || camera.near !== s.near || camera.far !== s.far) {
        camera.fov = s.fov;
        camera.near = s.near;
        camera.far = s.far;
        camera.updateProjectionMatrix();
      }
    }
  });
  return null;
}

function Pane({
  index,
  url,
  extraModels,
  shared,
  viewRef,
}: {
  index: number;
  url: string | null;
  extraModels: PlacedModel[];
  shared: MutableRefObject<SharedCamera>;
  viewRef?: MutableRefObject<ViewHandle | null>;
}) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  return (
    <Canvas
      camera={{ position: [0, 2, 5], fov: 50 }}
      style={{ position: 'absolute', inset: 0 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1 }}
      scene={{ background: new THREE.Color(isDark ? 0x111827 : 0xf3f4f6) }}
    >
      <Suspense fallback={null}>
        {url && <Scene glbUrl={url} extraModels={extraModels} viewRef={viewRef} />}
        <OrbitControls makeDefault enableDamping dampingFactor={0.1} rotateSpeed={0.5} zoomSpeed={0.8} panSpeed={0.5} />
        <CameraSync index={index} shared={shared} />
        <Environment preset="city" background={false} environmentIntensity={isDark ? 0.6 : 1} />
        <ambientLight intensity={isDark ? 0.15 : 0.25} />
        <directionalLight position={[10, 10, 5]} intensity={isDark ? 0.5 : 0.7} />
      </Suspense>
    </Canvas>
  );
}

const Chip = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div
    className={`absolute top-3 z-10 max-w-[45%] truncate bg-[var(--ds-surface)] px-3 py-1 rounded-full shadow text-xs font-medium text-[var(--ds-fg)] border border-[var(--ds-border)] pointer-events-none ${className}`}
  >
    {children}
  </div>
);

export default function CompareView({
  mode,
  urls,
  labels,
  extraModels,
}: {
  mode: CompareMode;
  urls: [string | null, string | null];
  labels: [string, string];
  extraModels: PlacedModel[];
}) {
  const t = useTranslations('Compare');
  const shared = useRef<SharedCamera>({
    leader: 0,
    position: new THREE.Vector3(),
    target: new THREE.Vector3(),
    fov: 50,
    near: 0.1,
    far: 1000,
    ready: false,
  });
  const viewRef = useRef<ViewHandle | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const split = useRef(50); // swipe line, % from the left
  const lens = useRef<{ x: number; y: number } | null>(null);

  // The second pane's clip is set on the element directly: the pointer moves it
  // many times a second, and the canvases should not re-render for that.
  const applyClip = useCallback(() => {
    const top = topRef.current;
    if (!top) return;
    if (mode === 'swipe') {
      top.style.clipPath = `inset(0 0 0 ${split.current}%)`;
      if (lineRef.current) lineRef.current.style.left = `${split.current}%`;
    } else if (mode === 'spyglass') {
      const box = boxRef.current;
      const p = lens.current ?? (box ? { x: box.clientWidth / 2, y: box.clientHeight / 2 } : { x: 0, y: 0 });
      top.style.clipPath = `circle(${LENS_RADIUS}px at ${p.x}px ${p.y}px)`;
      if (ringRef.current) ringRef.current.style.transform = `translate(${p.x - LENS_RADIUS}px, ${p.y - LENS_RADIUS}px)`;
    } else {
      top.style.clipPath = '';
    }
  }, [mode]);

  useEffect(applyClip, [applyClip]);

  const onPointerMove = (e: React.PointerEvent) => {
    if (mode !== 'spyglass' || !boxRef.current) return;
    const r = boxRef.current.getBoundingClientRect();
    lens.current = { x: e.clientX - r.left, y: e.clientY - r.top };
    applyClip();
  };

  const dragLine = (e: React.PointerEvent) => {
    const box = boxRef.current;
    if (!box) return;
    e.preventDefault();
    e.stopPropagation();
    const move = (ev: PointerEvent) => {
      const r = box.getBoundingClientRect();
      split.current = Math.min(100, Math.max(0, ((ev.clientX - r.left) / r.width) * 100));
      applyClip();
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const side = mode === 'side';
  // the view buttons fly the first pane's camera; the second follows it
  const fly = (f: (v: ViewHandle) => void) => {
    shared.current.leader = 0;
    if (viewRef.current) f(viewRef.current);
  };

  return (
    <div
      ref={boxRef}
      onPointerMove={onPointerMove}
      className={`relative w-full h-full overflow-hidden bg-gray-100 dark:bg-gray-900 ${side ? 'flex flex-col sm:flex-row gap-px bg-[var(--ds-border)]' : ''}`}
    >
      <div className={side ? 'relative flex-1 min-w-0 min-h-0' : 'absolute inset-0'}>
        <Pane index={0} url={urls[0]} extraModels={extraModels} shared={shared} viewRef={viewRef} />
        <Chip className="left-3">A: {labels[0]}</Chip>
      </div>
      <div ref={topRef} className={side ? 'relative flex-1 min-w-0 min-h-0' : 'absolute inset-0'}>
        <Pane index={1} url={urls[1]} extraModels={extraModels} shared={shared} />
        {side && <Chip className="left-3">B: {labels[1]}</Chip>}
      </div>
      {/* outside the clipped pane, so that the label stays visible */}
      {!side && <Chip className="right-3">B: {labels[1]}</Chip>}
      {mode === 'spyglass' && (
        <div
          ref={ringRef}
          className="absolute top-0 left-0 z-10 rounded-full border-2 border-white shadow-[0_0_6px_rgba(0,0,0,0.6)] pointer-events-none"
          style={{ width: LENS_RADIUS * 2, height: LENS_RADIUS * 2 }}
        />
      )}
      {mode === 'swipe' && (
        <div
          ref={lineRef}
          onPointerDown={dragLine}
          role="separator"
          aria-orientation="vertical"
          aria-label={t('swipeHandle')}
          className="absolute top-0 bottom-0 z-20 w-4 -ml-2 cursor-ew-resize flex items-center justify-center touch-none"
          style={{ left: `${split.current}%` }}
        >
          <div className="w-0.5 h-full bg-white shadow-[0_0_4px_rgba(0,0,0,0.6)]" />
          <div className="absolute w-7 h-7 rounded-full bg-white shadow flex items-center justify-center text-gray-700 text-xs select-none">
            ⇔
          </div>
        </div>
      )}
      {mode === 'spyglass' && (
        <div className="absolute bottom-3 right-3 z-10 text-xs bg-[var(--ds-surface)]/90 px-2 py-1 rounded shadow text-[var(--ds-fg)] pointer-events-none">
          {t('spyglassHint')}
        </div>
      )}
      <div className="absolute top-12 right-3 z-20 flex flex-col rounded overflow-hidden shadow">
        <button
          onClick={() => fly((v) => v.fit())}
          className="min-h-[29px] px-2 text-xs bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border-b border-gray-200 dark:border-gray-600"
        >
          {t('fitAll')}
        </button>
        <button
          onClick={() => fly((v) => v.top())}
          className="min-h-[29px] px-2 text-xs bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          {t('topView')}
        </button>
      </div>
    </div>
  );
}
