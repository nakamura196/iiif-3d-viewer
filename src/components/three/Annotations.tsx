'use client';

import { useState } from 'react';
import { useThree } from '@react-three/fiber';
import gsap from 'gsap';
import AnnotationMarker from '@/components/three/AnnotationMarker';
import AreaMarker from '@/components/three/AreaMarker';
import { useAtom } from 'jotai';
import { annotationsAtom } from '@/atoms/infoPanelAtom';
import { selectedAnnotationIdAtom } from '@/atoms/infoPanelAtom';
import { useEffect } from 'react';
import { Vector3, Mesh } from 'three';
import { GLTF } from 'three-stdlib';

export default function Annotations({ model }: { model: GLTF }) {
  const [openAnnotationId, setOpenAnnotationId] = useState<string | null>(null);
  const [selectedAnnotationId, setSelectedAnnotationId] = useAtom(selectedAnnotationIdAtom);

  const [annotations] = useAtom(annotationsAtom);

  const { camera } = useThree();

  const [meshList, setMeshList] = useState<Mesh[]>([]);

  useEffect(() => {
    const meshes: Mesh[] = [];
    model.scene.traverse((child) => {
      if (child.type === 'Mesh') {
        meshes.push(child as Mesh);
      }
    });
    setMeshList(meshes);
  }, [model]);

  const focusOnAnnotation = (annotationId: string) => {
    const annotation = annotations.find((a) => a.id === annotationId);
    if (!annotation) return;

    const rawEndPosition = annotation.data.target.selector.camPos;

    const endPosition = new Vector3(rawEndPosition[0], rawEndPosition[1], rawEndPosition[2]);

    gsap.to(camera.position, {
      x: endPosition.x,
      y: endPosition.y,
      z: endPosition.z,
      duration: 1,
      ease: 'power2.inOut',
    });
  };

  useEffect(() => {
    if (selectedAnnotationId) {
      setOpenAnnotationId(selectedAnnotationId);
      focusOnAnnotation(selectedAnnotationId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAnnotationId]);

  return (
    <>
      {annotations.map((annotation, index) => {
        const selector = annotation.data?.target?.selector;

        const type = selector?.type;

        return type === '3DSelector' ? (
          <AnnotationMarker
            key={annotation.id}
            number={(index + 1).toString()}
            annotation={annotation}
            isOpen={openAnnotationId === annotation.id}
            onClick={() => {
              setSelectedAnnotationId(annotation.id);
            }}
            /*mesh={mesh} */
            meshList={meshList}
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
        // }
        return null;
      })}
    </>
  );
}
