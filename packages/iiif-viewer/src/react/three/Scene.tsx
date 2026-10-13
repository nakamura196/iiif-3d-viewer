'use client';

import { Suspense, useEffect, useImperativeHandle, useMemo, useRef, type Ref } from 'react';
import { Clone, useAnimations, useGLTF, Bounds } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { Box3, Group, PerspectiveCamera, Sphere, Vector3 } from 'three';
import gsap from 'gsap';
import Annotations from '../three/Annotations';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { manifestAtom, modelAnimationAtom, sceneIdAtom, showAnnotationsAtom } from '../atoms';
import { defaultCameraOf, type DefaultCamera } from '../../core';
import { runFocusFlight, type Vec3 } from '../../core';
import { fitView, topView } from '../../core';

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

// Plays the animations stored in the model (glTF animations), looped, all at once.
// The play/pause button outside the 3D view switches modelAnimationAtom.playing.
function useModelAnimation(model: { animations: import('three').AnimationClip[] }) {
  const root = useRef<Group>(null);
  const { actions } = useAnimations(model.animations, root);
  const setAnimation = useSetAtom(modelAnimationAtom);
  const { playing } = useAtomValue(modelAnimationAtom);

  useEffect(() => {
    setAnimation({ clips: model.animations.length, playing: true });
    return () => setAnimation({ clips: 0, playing: true });
  }, [model, setAnimation]);

  useEffect(() => {
    const all = Object.values(actions);
    all.forEach((a) => a?.reset().play());
    return () => all.forEach((a) => a?.stop());
  }, [actions]);

  useEffect(() => {
    Object.values(actions).forEach((a) => {
      if (a) a.paused = !playing;
    });
  }, [actions, playing]);

  return root;
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
  const sceneId = useAtomValue(sceneIdAtom);
  const model = useGLTF(glbUrl);
  const cam = useMemo(() => defaultCameraOf(manifest, sceneId), [manifest, sceneId]);
  const sphere = useMemo(() => new Box3().setFromObject(model.scene).getBoundingSphere(new Sphere()), [model]);
  const animationRoot = useModelAnimation(model);
  // A model with animations is drawn as it is loaded, not as a copy: the copy rebuilds each light
  // with a new target, so a spot light that the animation moves would keep pointing at the origin.
  const body = (
    <group ref={animationRoot}>
      {model.animations.length > 0 ? <primitive object={model.scene} /> : <Clone object={model.scene} />}
    </group>
  );

  return (
    <>
      {cam ? (
        <>
          {body}
          <ManifestCamera cam={cam} center={sphere.center} radius={sphere.radius} />
        </>
      ) : (
        /* Auto-frame the model regardless of its units (cm/m/mm) or center
           offset. Bounds fits the (makeDefault) OrbitControls camera to the
           model's bounding box on load, replacing the old fixed camera that
           left many Smithsonian scans off-screen / oversized. Only the model is
           wrapped so the fit targets the mesh, not the annotation markers. */
        <Bounds fit clip margin={1.2}>
          {body}
        </Bounds>
      )}
      {viewRef && <ViewController handle={viewRef} center={sphere.center} radius={sphere.radius} />}
      {extraModels.map((m, i) => (
        <Suspense key={i} fallback={null}>
          <PlacedGLTF url={m.url} position={m.position} />
        </Suspense>
      ))}
      {model && showAnnotations && <Annotations model={model} />}
    </>
  );
}
