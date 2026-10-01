'use client';

import { Suspense } from 'react';
import { Clone, useGLTF, Bounds } from '@react-three/drei';
import Annotations from '@/components/three/Annotations';
import { useAtom } from 'jotai';
import { showAnnotationsAtom } from '@/atoms/infoPanelAtom';

export interface PlacedModel {
  url: string;
  position: [number, number, number];
}

// A model painted into the Scene besides the main one (e.g. the ground). Each loads
// in its own Suspense so that switching it does not hide the rest of the scene.
function PlacedGLTF({ url, position }: PlacedModel) {
  const model = useGLTF(url);
  return (
    <group position={position}>
      <Clone object={model.scene} />
    </group>
  );
}

export default function Scene({ glbUrl, extraModels = [] }: { glbUrl: string; extraModels?: PlacedModel[] }) {
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
      {extraModels.map((m, i) => (
        <Suspense key={i} fallback={null}>
          <PlacedGLTF url={m.url} position={m.position} />
        </Suspense>
      ))}
      {model && showAnnotations && <Annotations model={model} />}
    </>
  );
}
