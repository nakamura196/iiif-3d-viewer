'use client';

import { Html } from '@react-three/drei';
import { useState } from 'react';
import { useThree } from '@react-three/fiber';
import gsap from 'gsap';
import AnnotationMarker from '@/components/three/editor/AnnotationMarker';
import type { Annotation3 as Annotation } from '@/types/main';
import { useAtom } from 'jotai';
import { selectedAnnotationIdAtom } from '@/atoms/infoPanelAtom';
import { useEffect } from 'react';
export default function Annotations({ annotations }: { annotations: Annotation[] }) {
  const [openAnnotationId, setOpenAnnotationId] = useState<string | null>(null);
  const [selectedAnnotationId, setSelectedAnnotationId] = useAtom(selectedAnnotationIdAtom);

  const { camera } = useThree();

  const focusOnAnnotation = (annotationId: string) => {
    const annotation = annotations.find((a) => a.id === annotationId);
    if (!annotation) return;
    const endPosition = annotation.cameraPosition.clone();

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
      {annotations.map((annotation) => (
        <Html
          key={annotation.id}
          position={[annotation.position.x, annotation.position.y, annotation.position.z]}
        >
          <AnnotationMarker
            number={annotation.id}
            content={annotation.content}
            isOpen={openAnnotationId === annotation.id}
            onClick={() => {
              setSelectedAnnotationId(annotation.id);
            }}
          />
        </Html>
      ))}
    </>
  );
}
