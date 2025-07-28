'use client';

import { Clone, useGLTF, OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsType } from 'three-stdlib';
import Annotations from '@/components/three/Annotations';
import { useRef } from 'react';

export default function Scene({ glbUrl }: { glbUrl: string }) {
  const controlsRef = useRef<OrbitControlsType>(null);
  // glbUrl = '/models/inscription_1.glb';
  const model = useGLTF(glbUrl);

  return (
    <>
      <OrbitControls ref={controlsRef} />
      <Clone object={model.scene} />
      {model && <Annotations model={model} />}
    </>
  );
}
