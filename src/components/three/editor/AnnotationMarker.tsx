export default function AnnotationMarker({
  number,
  content,
  isOpen,
  onClick,
}: {
  number: string;
  content: string;
  isOpen: boolean;
  onClick: () => void;
}) {
  return (
    <div className="relative">
      {/* マーカー（外周青、中は透明） */}
      <div
        onClick={onClick}
        className="w-6 h-6 border-2 border-blue-500 rounded-full cursor-pointer hover:border-blue-600 transition-colors"
      />

      {/* ポップアップ */}
      {isOpen && (
        <div className="absolute left-8 top-0 z-10">
          <div className="bg-white/90 backdrop-blur-sm px-3 py-2 rounded-lg shadow-lg w-[200px]">
            <div className="text-sm text-gray-800">{content}</div>
          </div>
        </div>
      )}
    </div>
  );
}
