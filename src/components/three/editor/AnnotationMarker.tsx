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
      {/* 番号マーカー */}
      <div
        onClick={onClick}
        className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center cursor-pointer hover:bg-blue-600 transition-colors"
      >
        <span className="text-white text-sm font-medium">{number}</span>
      </div>

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
