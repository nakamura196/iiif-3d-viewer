'use client';

import { Suspense, useEffect, useMemo } from 'react';
import { Clone, useGLTF, Bounds } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { Box3, PerspectiveCamera, Sphere, Vector3 } from 'three';
import Annotations from '@/components/three/Annotations';
import { useAtom } from 'jotai';
import { manifestAtom, showAnnotationsAtom } from '@/atoms/infoPanelAtom';
import { defaultCameraOf, type DefaultCamera } from '@/lib/services/manifestParser';

// Place the camera where the manifest's default Camera says (Presentation 4.0:
// the first Camera painted into the Scene). Without `lookAt`, look at the model's center.
function ManifestCamera({ cam, center, radius }: { cam: DefaultCamera; center: Vector3; radius: number }) {
  const { camera, controls } = useThree();
  useEffect(() => {
    const target = cam.lookAt ? new Vector3(...cam.lookAt) : center;
    camera.position.set(...cam.position);
    if (camera instanceof PerspectiveCamera) {
      if (cam.fieldOfView) camera.fov = cam.fieldOfView;
      // keep the whole model inside the clipping range from wherever the camera is
      const reach = camera.position.distanceTo(center) + radius;
      camera.near = Math.max(reach / 10000, 0.01);
      camera.far = reach * 2;
      camera.updateProjectionMatrix();
    }
    camera.lookAt(target);
    const orbit = controls as unknown as { target?: Vector3; update?: () => void } | null;
    orbit?.target?.copy(target);
    orbit?.update?.();
  }, [cam, center, radius, camera, controls]);
  return null;
}

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
  const [manifest] = useAtom(manifestAtom);
  const model = useGLTF(glbUrl);
  const cam = useMemo(() => defaultCameraOf(manifest), [manifest]);
  const sphere = useMemo(() => new Box3().setFromObject(model.scene).getBoundingSphere(new Sphere()), [model]);

  return (
    <>
      {cam ? (
        <>
          <Clone object={model.scene} />
          <ManifestCamera cam={cam} center={sphere.center} radius={sphere.radius} />
        </>
      ) : (
        /* Auto-frame the model regardless of its units (cm/m/mm) or center
           offset. Bounds fits the (makeDefault) OrbitControls camera to the
           model's bounding box on load, replacing the old fixed camera that
           left many Smithsonian scans off-screen / oversized. Only the model is
           wrapped so the fit targets the mesh, not the annotation markers. */
        <Bounds fit clip margin={1.2}>
          <Clone object={model.scene} />
        </Bounds>
      )}
      {extraModels.map((m, i) => (
        <Suspense key={i} fallback={null}>
          <PlacedGLTF url={m.url} position={m.position} />
        </Suspense>
      ))}
      {model && showAnnotations && <Annotations model={model} />}
    </>
  );
}
