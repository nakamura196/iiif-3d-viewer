'use client';

import { Clone, useGLTF } from '@react-three/drei';
import Annotations from '@/components/three/Annotations';
import { useAtom } from 'jotai';
import { showAnnotationsAtom } from '@/atoms/infoPanelAtom';

export default function Scene({ glbUrl }: { glbUrl: string }) {
  const [showAnnotations] = useAtom(showAnnotationsAtom);
  const model = useGLTF(glbUrl);

  return (
    <>
      <Clone object={model.scene} />
      {model && showAnnotations && <Annotations model={model} />}
    </>
  );
}
