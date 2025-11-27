import Popup from '@/components/three/Popup';
import { Html } from '@react-three/drei';
import { Annotation } from '@/types/main';

export default function AnnotationMarker({
  number,
  annotation,
  isOpen,
  onClick,
  isVisible = true,
}: {
  number: string;
  annotation: Annotation;
  isOpen: boolean;
  onClick: () => void;
  isVisible?: boolean;
}) {
  const content = annotation.data.body.label;
  const value = annotation.data.target.selector.value;

  return (
    <Html position={[value[0], value[1], value[2]]} style={{ opacity: isVisible ? 1 : 0.1 }}>
      <div className="relative">
        {/* マーカー（前面は青、背後はグレー + 透明度） */}
        <div
          onClick={onClick}
          className={`w-6 h-6 border-2 rounded-full cursor-pointer transition-colors ${
            isVisible
              ? 'border-blue-500 hover:border-blue-600'
              : 'border-gray-400 hover:border-gray-500'
          }`}
        />

        {/* ポップアップ */}
        {isOpen && <Popup content={content} />}
      </div>
    </Html>
  );
}
