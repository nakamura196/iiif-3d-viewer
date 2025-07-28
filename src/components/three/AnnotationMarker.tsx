import Popup from '@/components/three/Popup';
import { Html } from '@react-three/drei';
import { useThree, useFrame } from '@react-three/fiber';
import { useState, useRef } from 'react';
import { Vector3, Mesh, Frustum, Matrix4, Raycaster } from 'three';
import { Annotation } from '@/types/main';

export default function AnnotationMarker({
  number,
  annotation,
  isOpen,
  onClick,
  meshList,
}: {
  number: string;
  annotation: Annotation;
  isOpen: boolean;
  onClick: () => void;
  meshList: Mesh[];
}) {
  const { camera } = useThree();
  const content = annotation.data.body.label;
  const value = annotation.data.target.selector.value;
  const [opacity, setOpacity] = useState(1);
  const annotationRef = useRef<HTMLDivElement>(null);

  const frameInterval = 10; // 10フレームごと
  let frameCount = 0;

  useFrame(() => {
    frameCount++;
    if (frameCount % frameInterval !== 0) {
      return;
    }
    const annotationPosition = new Vector3(value[0], value[1], value[2]);

    // カメラの視野にアノテーションが入っているか判定 (Frustum)
    const frustum = new Frustum();
    const projectionMatrix = new Matrix4().multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse
    );
    frustum.setFromProjectionMatrix(projectionMatrix);
    const isInFrustum = frustum.containsPoint(annotationPosition);

    // カメラの向きとアノテーション位置の内積で前後を判定
    const cameraDirection = new Vector3();
    camera.getWorldDirection(cameraDirection);
    const toAnnotation = new Vector3().subVectors(annotationPosition, camera.position).normalize();
    const cameraDot = cameraDirection.dot(toAnnotation);
    const isFront = cameraDot > 0; // カメラ前方にあるかどうか

    // Raycasterでオブジェクトの遮蔽を判定
    // カメラ→アノテーションへのレイ
    const raycaster = new Raycaster(camera.position, toAnnotation);
    const intersects = raycaster.intersectObjects(meshList, true); // 子要素も含めたい場合はtrue

    // アノテーションまでの距離
    const annotationDistance = camera.position.distanceTo(annotationPosition);

    // 遮蔽されているかどうか (intersect距離 < アノテーションまでの距離)
    let isOccluded = false;
    if (intersects.length > 0) {
      const closest = intersects[0];
      if (closest.distance < annotationDistance - 0.01) {
        // 余裕を持たせたい場合は -0.01
        isOccluded = true;
      }
    }

    // 条件をまとめて透明度設定
    // (視野内 + 前方 + 遮蔽されていない場合のみフル表示)
    if (isInFrustum && isFront && !isOccluded) {
      setOpacity(1);
    } else {
      setOpacity(0.2);
    }
  });

  return (
    <Html position={[value[0], value[1], value[2]]} style={{ opacity }} ref={annotationRef}>
      <div className="relative">
        {/* 番号マーカー */}
        <div
          onClick={onClick}
          className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center cursor-pointer hover:bg-blue-600 transition-colors"
        >
          <span className="text-white text-sm font-medium">{number}</span>
        </div>

        {/* ポップアップ */}
        {isOpen && <Popup content={content} />}
      </div>
    </Html>
  );
}
