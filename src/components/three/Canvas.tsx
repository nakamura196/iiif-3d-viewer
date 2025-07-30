import { Canvas } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import { Suspense, useEffect, useState } from 'react';
import Scene from '@/components/three/Scene';
import { useProgress } from '@react-three/drei';
import { useTheme } from 'next-themes';
import * as THREE from 'three';
// ローディングコンポーネント
const LoadingScreen = () => {
  const { progress, total, loaded } = useProgress();

  return (
    <Html center>
      <div className="flex flex-col items-center bg-white/80 dark:bg-gray-800/80 p-6 rounded-lg backdrop-blur-sm">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <div className="text-gray-700 dark:text-gray-300 font-medium mb-2">
          3Dモデルを読み込み中...
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

const CanvasComponent = ({ glbUrl }: { glbUrl: string }) => {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [sceneRef, setSceneRef] = useState<THREE.Scene | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (sceneRef && mounted) {
      const isDark = theme === 'dark';
      sceneRef.background = isDark ? new THREE.Color(0x111827) : new THREE.Color(0xf3f4f6);
    }
  }, [theme, sceneRef, mounted]);

  const isDark = mounted && theme === 'dark';

  return (
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
      <Suspense fallback={<LoadingScreen />}>
        <Scene glbUrl={glbUrl} />
        <OrbitControls
          enableDamping={true}
          dampingFactor={0.05}
          rotateSpeed={0.5}
          zoomSpeed={0.8}
          panSpeed={0.5}
          minPolarAngle={0}
          maxPolarAngle={Math.PI}
        />
        <gridHelper args={[10, 10, isDark ? 0x374151 : 0x9ca3af, isDark ? 0x1f2937 : 0xe5e7eb]} />
        <ambientLight intensity={isDark ? 0.3 : 0.5} />
        <directionalLight position={[10, 10, 5]} intensity={isDark ? 0.8 : 1} />
      </Suspense>
    </Canvas>
  );
};

export default CanvasComponent;
