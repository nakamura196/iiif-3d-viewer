import { Html } from '@react-three/drei';
import { useMemo } from 'react';
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

  const vertices = useMemo(() => {
    if (!area) return [];
    const verts = [];
    for (let i = 0; i < area.length; i += 3) {
      verts.push([area[i], area[i + 1], area[i + 2]]);
    }
    return verts;
  }, [area]);

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

  if (!area) return null;

  return (
    <mesh onClick={onClick}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={vertices.length}
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
