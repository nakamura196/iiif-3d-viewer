import { Html } from '@react-three/drei';
import { useMemo, useRef, useEffect } from 'react';
import { Annotation } from '@/types/main';
import * as THREE from 'three';
import Popup from '@/components/three/Popup';

export default function AreaMarker({
  annotation,
  number,
  isOpen,
  onClick,
}: {
  annotation: Annotation;
  number: string;
  isOpen: boolean;
  onClick: () => void;
}) {
  const content = annotation.data.body.label;
  const selector = annotation.data.target.selector;
  const area = selector.area;
  const geometryRef = useRef<THREE.BufferGeometry>(null);

  // 頂点数を計算
  const vertexCount = useMemo(() => {
    if (!area) return 0;
    return area.length / 3;
  }, [area]);

  // 三角形分割用のインデックスを生成（ファン分割）
  const indices = useMemo(() => {
    if (vertexCount < 3) return [];
    const triangleIndices: number[] = [];
    // ファン分割: 頂点0を中心として、(0,1,2), (0,2,3), (0,3,4), ... を生成
    for (let i = 1; i < vertexCount - 1; i++) {
      triangleIndices.push(0, i, i + 1);
    }
    return triangleIndices;
  }, [vertexCount]);

  // 中心位置を計算
  const center = useMemo(() => {
    if (!area) return new THREE.Vector3(0, 0, 0);
    const length = area.length;
    const sum = [0, 0, 0];
    for (let i = 0; i < length; i += 3) {
      sum[0] += area[i];
      sum[1] += area[i + 1];
      sum[2] += area[i + 2];
    }
    return new THREE.Vector3(sum[0] / (length / 3), sum[1] / (length / 3), sum[2] / (length / 3));
  }, [area]);

  // ジオメトリにインデックスを設定
  useEffect(() => {
    if (geometryRef.current && indices.length > 0) {
      geometryRef.current.setIndex(indices);
      geometryRef.current.computeVertexNormals();
    }
  }, [indices]);

  if (!area || vertexCount < 3) return null;

  return (
    <mesh onClick={onClick}>
      <bufferGeometry ref={geometryRef}>
        <bufferAttribute
          attach="attributes-position"
          count={vertexCount}
          array={new Float32Array(area)}
          itemSize={3}
          args={[new Float32Array(area), 3]}
        />
      </bufferGeometry>
      <meshBasicMaterial color="#fbbf24" opacity={0.3} transparent side={THREE.DoubleSide} />
      {isOpen && (
        <Html position={center}>
          <Popup content={number + '. ' + content} />
        </Html>
      )}
    </mesh>
  );
}
