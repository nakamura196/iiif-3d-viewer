'use client';

import { Clone, useGLTF, Bounds } from '@react-three/drei';
import Annotations from '@/components/three/Annotations';
import { useAtom } from 'jotai';
import { showAnnotationsAtom } from '@/atoms/infoPanelAtom';

export default function Scene({ glbUrl }: { glbUrl: string }) {
  const [showAnnotations] = useAtom(showAnnotationsAtom);
  const model = useGLTF(glbUrl);

  return (
    <>
      {/* Auto-frame the model regardless of its units (cm/m/mm) or center
          offset. Bounds fits the (makeDefault) OrbitControls camera to the
          model's bounding box on load, replacing the old fixed camera that
          left many Smithsonian scans off-screen / oversized. Only the model is
          wrapped so the fit targets the mesh, not the annotation markers. */}
      <Bounds fit clip margin={1.2}>
        <Clone object={model.scene} />
      </Bounds>
      {model && showAnnotations && <Annotations model={model} />}
    </>
  );
}
