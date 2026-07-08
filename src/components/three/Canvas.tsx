import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import { Suspense, useEffect, useState, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';
import Scene from '@/components/three/Scene';
import { useProgress } from '@react-three/drei';
import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsType } from 'three-stdlib';

// MapLibre風のイージング関数
const easeOutCubic = (t: number): number => {
  return 1 - Math.pow(1 - t, 3);
};
// ローディングコンポーネント
const LoadingScreen = ({ loadingText }: { loadingText: string }) => {
  const { progress, total, loaded } = useProgress();

  return (
    <Html center>
      <div className="flex flex-col items-center bg-white/80 dark:bg-gray-800/80 p-6 rounded-lg backdrop-blur-sm">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <div className="text-gray-700 dark:text-gray-300 font-medium mb-2">
          {loadingText}
        </div>
        <div className="w-48 bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mb-2">
          <div
            className="bg-blue-500 h-2.5 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {Math.round(progress)}% ({(loaded / 1024 / 1024).toFixed(2)}MB /{' '}
          {(total / 1024 / 1024).toFixed(2)}MB)
        </div>
      </div>
    </Html>
  );
};

// カメラズーム制御用のコンポーネント（MapLibre風スムーズズーム）
interface CameraControllerProps {
  controlsRef: React.RefObject<OrbitControlsType | null>;
}

interface ZoomAnimation {
  startTime: number;
  duration: number;
  startDistance: number;
  targetDistance: number;
}

const ZOOM_DURATION = 300; // ミリ秒
const ZOOM_FACTOR = 0.3; // ズーム量（割合）

const CameraController = forwardRef<{ zoomIn: () => void; zoomOut: () => void }, CameraControllerProps>(
  ({ controlsRef }, ref) => {
    const { camera } = useThree();
    const zoomAnimationRef = useRef<ZoomAnimation | null>(null);
    const targetRef = useRef(new THREE.Vector3(0, 0, 0));

    // アニメーションフレーム処理
    useFrame(() => {
      if (!zoomAnimationRef.current || !controlsRef.current) return;

      const { startTime, duration, startDistance, targetDistance } = zoomAnimationRef.current;
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutCubic(progress);

      // OrbitControlsのターゲットを取得
      const target = controlsRef.current.target;
      targetRef.current.copy(target);

      // カメラからターゲットへの方向ベクトル
      const direction = new THREE.Vector3();
      direction.subVectors(camera.position, targetRef.current).normalize();

      // 現在の距離を補間
      const currentDistance = startDistance + (targetDistance - startDistance) * easedProgress;

      // カメラ位置を更新
      camera.position.copy(targetRef.current).addScaledVector(direction, currentDistance);
      controlsRef.current.update();

      // アニメーション完了
      if (progress >= 1) {
        zoomAnimationRef.current = null;
      }
    });

    const startZoomAnimation = useCallback((zoomIn: boolean) => {
      if (!controlsRef.current) return;

      const target = controlsRef.current.target;
      const currentDistance = camera.position.distanceTo(target);

      // ズームイン/アウトに応じて目標距離を計算
      const factor = zoomIn ? (1 - ZOOM_FACTOR) : (1 + ZOOM_FACTOR);
      const targetDistance = currentDistance * factor;

      // 最小/最大距離の制限
      const minDistance = 0.5;
      const maxDistance = 50;
      const clampedTargetDistance = Math.max(minDistance, Math.min(maxDistance, targetDistance));

      zoomAnimationRef.current = {
        startTime: performance.now(),
        duration: ZOOM_DURATION,
        startDistance: currentDistance,
        targetDistance: clampedTargetDistance,
      };
    }, [camera, controlsRef]);

    useImperativeHandle(ref, () => ({
      zoomIn: () => startZoomAnimation(true),
      zoomOut: () => startZoomAnimation(false),
    }), [startZoomAnimation]);

    return null;
  }
);
CameraController.displayName = 'CameraController';

interface CanvasComponentProps {
  glbUrl: string;
  attribution?: string;
}

const CanvasComponent = ({ glbUrl, attribution }: CanvasComponentProps) => {
  const { resolvedTheme } = useTheme();
  const t = useTranslations('Viewer');
  const [mounted, setMounted] = useState(false);
  const [sceneRef, setSceneRef] = useState<THREE.Scene | null>(null);
  const controlsRef = useRef<OrbitControlsType>(null);
  const cameraControllerRef = useRef<{ zoomIn: () => void; zoomOut: () => void }>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (sceneRef && mounted) {
      const isDark = resolvedTheme === 'dark';
      sceneRef.background = isDark ? new THREE.Color(0x111827) : new THREE.Color(0xf3f4f6);
    }
  }, [resolvedTheme, sceneRef, mounted]);

  const isDark = mounted && resolvedTheme === 'dark';

  const handleZoomIn = () => {
    cameraControllerRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    cameraControllerRef.current?.zoomOut();
  };

  return (
    <div className="relative w-full h-full">
      <Canvas
        camera={{
          position: [0, 2, 5],
          fov: 50,
        }}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
        }}
        gl={{ antialias: true }}
        onCreated={({ scene }) => {
          setSceneRef(scene);
          // Set initial background color based on theme
          scene.background = isDark ? new THREE.Color(0x111827) : new THREE.Color(0xf3f4f6);
        }}
      >
        <Suspense fallback={<LoadingScreen loadingText={t('loading')} />}>
          <Scene glbUrl={glbUrl} />
          <OrbitControls
            ref={controlsRef}
            makeDefault
            enableDamping={true}
            dampingFactor={0.1}
            rotateSpeed={0.5}
            zoomSpeed={0.8}
            panSpeed={0.5}
            minPolarAngle={0}
            maxPolarAngle={Math.PI}
          />
          <CameraController ref={cameraControllerRef} controlsRef={controlsRef} />
          <gridHelper args={[10, 10, isDark ? 0x374151 : 0x9ca3af, isDark ? 0x1f2937 : 0xe5e7eb]} />
          <ambientLight intensity={isDark ? 0.3 : 0.5} />
          <directionalLight position={[10, 10, 5]} intensity={isDark ? 0.8 : 1} />
        </Suspense>
      </Canvas>
      {/* ズームボタン（MapLibre GL風） */}
      <div className="absolute top-4 right-4 z-10 flex flex-col rounded overflow-hidden shadow">
        <button
          onClick={handleZoomIn}
          className="w-[29px] h-[29px] bg-white dark:bg-gray-800 flex items-center justify-center text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border-b border-gray-200 dark:border-gray-600"
          aria-label="Zoom in"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12M6 12h12" />
          </svg>
        </button>
        <button
          onClick={handleZoomOut}
          className="w-[29px] h-[29px] bg-white dark:bg-gray-800 flex items-center justify-center text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          aria-label="Zoom out"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 12h12" />
          </svg>
        </button>
      </div>
      {/* Attribution（MapLibre GL風） */}
      {attribution && (
        <div className="absolute bottom-3 right-3 z-10 bg-white/90 dark:bg-gray-800/90 px-3 py-1.5 text-sm text-gray-800 dark:text-gray-200 rounded shadow-sm font-medium">
          {attribution}
        </div>
      )}
    </div>
  );
};

export default CanvasComponent;
