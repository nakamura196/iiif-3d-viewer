'use client';

import { startTransition, Suspense, useEffect, useImperativeHandle, useMemo, useRef, type Ref } from 'react';
import { Clone, useGLTF, Bounds } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { Box3, PerspectiveCamera, Points, PointsMaterial, Sphere, Vector3, type Object3D } from 'three';
import gsap from 'gsap';
import Annotations from '@/components/three/Annotations';
import { useAtom } from 'jotai';
import { manifestAtom, modelChoicesAtom, paintedModelsAtom, showAnnotationsAtom } from '@/atoms/infoPanelAtom';
import { upgradeUrl } from '@/lib/services/paintedModels';
import { defaultCameraOf, type DefaultCamera } from '@/lib/services/manifestParser';
import { runFocusFlight, type Vec3 } from '@/lib/focusCamera';
import { fitView, topView } from '@/lib/viewCamera';

// Place the camera where the manifest's default Camera says (Presentation 4.0:
// the first Camera painted into the Scene). Without `lookAt`, look at the model's center.
function ManifestCamera({ cam, center, radius }: { cam: DefaultCamera; center: Vector3; radius: number }) {
  const { camera, controls } = useThree();
  // once per Camera: a progressive model swapped in later must not pull the view back
  const applied = useRef<DefaultCamera | null>(null);
  useEffect(() => {
    if (applied.current === cam) return;
    applied.current = cam;
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

// What the canvas view buttons ask of the scene.
export interface ViewHandle {
  fit: () => void; // 全体
  top: () => void; // 上
  goTo: (cam: DefaultCamera) => void; // a Camera from the manifest
}

// Flies the camera for the view buttons. Lives inside the Canvas (needs the camera and
// the OrbitControls) and next to the model (needs its bounding sphere).
function ViewController({ handle, center, radius }: { handle: Ref<ViewHandle>; center: Vector3; radius: number }) {
  const { camera, controls, size } = useThree();
  useImperativeHandle(handle, () => {
    const c: Vec3 = [center.x, center.y, center.z];
    // read at click time: the manifest's default Camera may have set the fov after mount
    const fov = () => (camera instanceof PerspectiveCamera ? camera.fov : 50);
    const aspect = size.height > 0 ? size.width / size.height : 1;
    const fly = (position: Vec3, target: Vec3) => {
      if (camera instanceof PerspectiveCamera) {
        // keep the whole model inside the clipping range at the new distance
        const reach = Math.hypot(position[0] - c[0], position[1] - c[1], position[2] - c[2]) + radius;
        camera.near = Math.max(reach / 10000, 0.01);
        camera.far = Math.max(camera.far, reach * 2);
        camera.updateProjectionMatrix();
      }
      const orbit = controls as unknown as { target: Vector3; update?: () => void; enabled?: boolean } | null;
      runFocusFlight({ camera, controls: orbit, gsap }, position, target);
    };
    const here: () => Vec3 = () => [camera.position.x, camera.position.y, camera.position.z];
    return {
      fit: () => {
        const v = fitView(c, radius, here(), fov(), aspect);
        fly(v.position, v.target);
      },
      top: () => {
        const v = topView(c, radius, fov(), aspect);
        fly(v.position, v.target);
      },
      goTo: (cam) => fly(cam.position, cam.lookAt ?? c),
    };
  }, [camera, controls, size, center, radius]);
  return null;
}

// A glTF point cloud without a material is drawn by three.js one pixel per point,
// which leaves a sparse cloud almost invisible. Give such points a size in metres
// from their spacing (area seen from above / count), so that they touch.
function sizePoints(root: Object3D, fov: number) {
  root.traverse((o) => {
    if (!(o instanceof Points) || !(o.material instanceof PointsMaterial) || o.material.sizeAttenuation) return;
    const box = new Box3().setFromObject(o);
    const count = o.geometry.getAttribute('position')?.count ?? 0;
    if (count === 0) return;
    const spacing = Math.sqrt(((box.max.x - box.min.x) * (box.max.z - box.min.z)) / count);
    // three.js draws a point size*(h/2)/depth px tall; an m-metre object is m*(h/2)/(depth*tan(fov/2))
    o.material.size = (1.5 * spacing) / Math.tan(((fov / 2) * Math.PI) / 180);
    o.material.sizeAttenuation = true;
    o.material.needsUpdate = true;
  });
}

function useSizedPoints(root: Object3D) {
  const { camera } = useThree();
  const fov = camera instanceof PerspectiveCamera ? camera.fov : 50;
  useMemo(() => sizePoints(root, fov), [root, fov]);
}

// Loads a progressive model's detailed version without showing it, then makes it the
// chosen option. useGLTF caches the result, so the swap itself does not suspend.
function Upgrade({ url, onReady }: { url: string; onReady: () => void }) {
  useGLTF(url);
  useEffect(onReady, [onReady]);
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
  useSizedPoints(model.scene);
  return (
    <group position={position}>
      <Clone object={model.scene} />
    </group>
  );
}

export default function Scene({
  glbUrl,
  extraModels = [],
  viewRef,
}: {
  glbUrl: string;
  extraModels?: PlacedModel[];
  viewRef?: Ref<ViewHandle>;
}) {
  const [showAnnotations] = useAtom(showAnnotationsAtom);
  const [manifest] = useAtom(manifestAtom);
  const [paintedModels] = useAtom(paintedModelsAtom);
  const [choices, setChoices] = useAtom(modelChoicesAtom);
  const model = useGLTF(glbUrl);
  useSizedPoints(model.scene);
  const upgrades = useMemo(
    () =>
      paintedModels.flatMap((m) => {
        const url = upgradeUrl(m, choices);
        return url ? [{ id: m.id, url, index: m.options.length - 1 }] : [];
      }),
    [paintedModels, choices],
  );
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
      {viewRef && <ViewController handle={viewRef} center={sphere.center} radius={sphere.radius} />}
      {extraModels.map((m, i) => (
        <Suspense key={i} fallback={null}>
          <PlacedGLTF url={m.url} position={m.position} />
        </Suspense>
      ))}
      {upgrades.map((u) => (
        <Suspense key={u.id} fallback={null}>
          <Upgrade
            url={u.url}
            onReady={() => startTransition(() => setChoices((c) => (u.id in c ? c : { ...c, [u.id]: u.index })))}
          />
        </Suspense>
      ))}
      {model && showAnnotations && <Annotations model={model} />}
    </>
  );
}
