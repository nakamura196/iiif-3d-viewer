'use client';

import { useState, useRef, useMemo, useCallback } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import gsap from 'gsap';
import AnnotationMarker from '@/components/three/AnnotationMarker';
import AreaMarker from '@/components/three/AreaMarker';
import { useAtom } from 'jotai';
import { annotationsAtom } from '@/atoms/infoPanelAtom';
import { selectedAnnotationIdAtom } from '@/atoms/infoPanelAtom';
import { useEffect } from 'react';
import { Vector3, Mesh, Frustum, Matrix4, Raycaster, Box3, Sphere } from 'three';
import { GLTF } from 'three-stdlib';

// 再利用可能なオブジェクト
const sharedFrustum = new Frustum();
const sharedMatrix = new Matrix4();
const sharedRaycaster = new Raycaster();
const sharedCameraDirection = new Vector3();
const sharedToAnnotation = new Vector3();
const prevCameraPosition = new Vector3();

// パフォーマンス設定
const CAMERA_MOVE_THRESHOLD = 0.01; // カメラ移動の閾値（スクロール時の微小な動きを無視）
const IDLE_FRAMES_BEFORE_RAYCAST = 30; // 停止後このフレーム数待ってからRaycast（約0.5秒 @ 60fps）

export default function Annotations({ model }: { model: GLTF }) {
  const [openAnnotationId, setOpenAnnotationId] = useState<string | null>(null);
  const [selectedAnnotationId, setSelectedAnnotationId] = useAtom(selectedAnnotationIdAtom);
  const [annotations] = useAtom(annotationsAtom);
  const { camera } = useThree();
  // OrbitControls(makeDefault)。注視点(target)を動かすために取得する。
  const controls = useThree((s) => s.controls) as unknown as
    | { target: Vector3; update?: () => void }
    | null;
  const [meshList, setMeshList] = useState<Mesh[]>([]);
  const [visibilityMap, setVisibilityMap] = useState<Record<string, boolean>>({});
  const idleFrameCountRef = useRef(0);
  const needsRaycastRef = useRef(true);

  useEffect(() => {
    const meshes: Mesh[] = [];
    model.scene.traverse((child) => {
      if (child.type === 'Mesh') {
        meshes.push(child as Mesh);
      }
    });
    setMeshList(meshes);
  }, [model]);

  // アノテーション位置をメモ化
  const annotationPositions = useMemo(() => {
    const positions: Record<string, Vector3> = {};
    annotations.forEach((annotation) => {
      const value = annotation.data?.target?.selector?.value;
      if (value) {
        positions[annotation.id] = new Vector3(value[0], value[1], value[2]);
      }
    });
    return positions;
  }, [annotations]);

  // カメラが停止した時のみRaycastを実行
  useFrame(() => {
    if (annotations.length === 0) return;

    // カメラの移動量をチェック
    const cameraMoved = camera.position.distanceTo(prevCameraPosition) > CAMERA_MOVE_THRESHOLD;
    prevCameraPosition.copy(camera.position);

    if (cameraMoved) {
      // カメラが動いている間はカウンタをリセット
      idleFrameCountRef.current = 0;
      needsRaycastRef.current = true;
      return;
    }

    // カメラが停止している
    idleFrameCountRef.current++;

    // 停止後、一定フレーム待ってからRaycast実行（1回のみ）
    if (!needsRaycastRef.current) return;
    if (idleFrameCountRef.current < IDLE_FRAMES_BEFORE_RAYCAST) return;

    // Raycast実行
    needsRaycastRef.current = false;

    // Frustum更新
    sharedMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    sharedFrustum.setFromProjectionMatrix(sharedMatrix);
    camera.getWorldDirection(sharedCameraDirection);

    const newVisibilityMap: Record<string, boolean> = {};
    const visibleAnnotations: { id: string; position: Vector3 }[] = [];

    // 第1パス: Frustum + カメラ前方判定（軽量）
    annotations.forEach((annotation) => {
      const position = annotationPositions[annotation.id];
      if (!position) {
        newVisibilityMap[annotation.id] = true;
        return;
      }

      // Frustum判定
      if (!sharedFrustum.containsPoint(position)) {
        newVisibilityMap[annotation.id] = false;
        return;
      }

      // カメラ前後判定
      sharedToAnnotation.subVectors(position, camera.position).normalize();
      if (sharedCameraDirection.dot(sharedToAnnotation) <= 0) {
        newVisibilityMap[annotation.id] = false;
        return;
      }

      // 視野内のアノテーションをリストに追加
      visibleAnnotations.push({ id: annotation.id, position });
    });

    // 第2パス: 視野内のアノテーションのみRaycast（重い処理）
    if (meshList.length > 0) {
      visibleAnnotations.forEach(({ id, position }) => {
        sharedToAnnotation.subVectors(position, camera.position).normalize();
        sharedRaycaster.set(camera.position, sharedToAnnotation);
        const intersects = sharedRaycaster.intersectObjects(meshList, true);
        const distance = camera.position.distanceTo(position);

        if (intersects.length > 0 && intersects[0].distance < distance - 0.01) {
          newVisibilityMap[id] = false;
        } else {
          newVisibilityMap[id] = true;
        }
      });
    } else {
      // メッシュがない場合は視野内=可視
      visibleAnnotations.forEach(({ id }) => {
        newVisibilityMap[id] = true;
      });
    }

    setVisibilityMap(newVisibilityMap);
  });

  // モデルのバウンディング球半径（フォーカス時のカメラ距離の基準）
  const focusRadius = useMemo(() => {
    const sphere = new Sphere();
    new Box3().setFromObject(model.scene).getBoundingSphere(sphere);
    return sphere.radius || 1;
  }, [model]);

  const focusOnAnnotation = useCallback((annotationId: string) => {
    const annotation = annotations.find((a) => a.id === annotationId);
    if (!annotation) return;

    const value = annotation.data?.target?.selector?.value;
    if (!value) return;
    const targetPos = new Vector3(value[0], value[1], value[2]);

    // カメラ位置：マニフェストに camPos（Voyager由来の推奨視点）があればそれを使う。
    // 無ければ「現在の視線方向を保ったままアノテーション点へ寄る」ヒューリスティック
    // （フィーチャを画面中央に収める）。
    const camPosRaw = annotation.data?.target?.selector?.camPos as
      | number[]
      | undefined;
    let endPosition: Vector3;
    if (Array.isArray(camPosRaw) && camPosRaw.length >= 3) {
      endPosition = new Vector3(camPosRaw[0], camPosRaw[1], camPosRaw[2]);
    } else {
      const dir = new Vector3().subVectors(camera.position, targetPos);
      if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1);
      dir.normalize();
      endPosition = new Vector3()
        .copy(targetPos)
        .addScaledVector(dir, focusRadius * 1.1);
    }

    gsap.to(camera.position, {
      x: endPosition.x,
      y: endPosition.y,
      z: endPosition.z,
      duration: 1,
      ease: 'power2.inOut',
    });
    // OrbitControls の注視点もアノテーション点へ移動＝フィーチャが中央に来る。
    // これが無いとカメラだけ動いて注視点が原点のまま＝フィーチャが端に寄る。
    if (controls?.target) {
      gsap.to(controls.target, {
        x: targetPos.x,
        y: targetPos.y,
        z: targetPos.z,
        duration: 1,
        ease: 'power2.inOut',
        onUpdate: () => controls.update?.(),
      });
    }
  }, [annotations, camera, controls, focusRadius]);

  useEffect(() => {
    if (selectedAnnotationId) {
      setOpenAnnotationId(selectedAnnotationId);
      focusOnAnnotation(selectedAnnotationId);
    }
  }, [selectedAnnotationId, focusOnAnnotation]);

  return (
    <>
      {annotations.map((annotation, index) => {
        const selector = annotation.data?.target?.selector;
        const type = selector?.type;

        return type === 'PointSelector' ? (
          <AnnotationMarker
            key={annotation.id}
            annotation={annotation}
            isOpen={openAnnotationId === annotation.id}
            onClick={() => {
              setSelectedAnnotationId(annotation.id);
            }}
            isVisible={visibilityMap[annotation.id] ?? true}
          />
        ) : (
          <AreaMarker
            key={annotation.id}
            number={(index + 1).toString()}
            annotation={annotation}
            isOpen={openAnnotationId === annotation.id}
            onClick={() => {
              setSelectedAnnotationId(annotation.id);
            }}
          />
        );
      })}
    </>
  );
}
