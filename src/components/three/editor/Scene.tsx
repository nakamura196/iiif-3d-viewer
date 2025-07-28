'use client';

import { Clone, useGLTF, OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsType } from 'three-stdlib';
import type { ThreeEvent } from '@react-three/fiber';
import Annotations from '@/components/three/editor/Annotations';

import { Vector3 } from 'three';
import { useRef } from 'react';
import { useThree } from '@react-three/fiber';
import type { Annotation3 as Annotation } from '@/types/main';
import { useAtom } from 'jotai';
import { annotationsAtom3 } from '@/atoms/infoPanelAtom';

export default function Scene({ glbUrl }: { glbUrl: string }) {
  const controlsRef = useRef<OrbitControlsType>(null);
  const [annotations, setAnnotations] = useAtom(annotationsAtom3);
  // const [annotations, setAnnotations] = useState<Annotation[]>(sampleAnnotations);
  const { camera } = useThree();
  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    // クリック位置のワールド座標を取得
    if (event.point) {
      // クリック位置のワールド座標を取得
      const clickedPosition = new Vector3(event.point.x, event.point.y, event.point.z);

      const annotation: Annotation = {
        id: (annotations.length + 1).toString(),
        position: clickedPosition,
        content: '新しいアノテーション',
        cameraPosition: camera.position.clone(),
        targetPosition: controlsRef.current?.target.clone() || new Vector3(),
      };

      setAnnotations([...annotations, annotation]);
    }
  };

  const model = useGLTF(glbUrl);
  return (
    <>
      <OrbitControls ref={controlsRef} />
      <Clone object={model.scene} onDoubleClick={handleClick} />
      <Annotations annotations={annotations} />
    </>
  );
}
