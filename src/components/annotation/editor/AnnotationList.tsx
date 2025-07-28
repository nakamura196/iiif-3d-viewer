import { annotationsAtom3, selectedAnnotationIdAtom } from '@/atoms/infoPanelAtom';
import { useAtom } from 'jotai';
import type { Annotation3 } from '@/types/main';

export default function AnnotationList() {
  const [annotations, setAnnotations] = useAtom(annotationsAtom3);
  const [selectedAnnotationId, setSelectedAnnotationId] = useAtom(selectedAnnotationIdAtom);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // クリックイベントの伝播を止める
    setAnnotations(annotations.filter((a) => a.id !== id));
    if (selectedAnnotationId === id) {
      setSelectedAnnotationId(null);
    }
  };

  const focusOnAnnotation = (annotation: Annotation3) => {
    setSelectedAnnotationId(annotation.id);
  };
  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-6 text-gray-800">アノテーション一覧</h2>
      <div className="space-y-4">
        {annotations.map((annotation) => (
          <div
            key={annotation.id}
            onClick={() => focusOnAnnotation(annotation)}
            className={`group rounded-lg shadow-sm hover:shadow-md transition-all duration-200 
                cursor-pointer border overflow-hidden
                ${
                  selectedAnnotationId === annotation.id
                    ? 'bg-blue-50 border-blue-300'
                    : 'bg-white border-gray-100 hover:border-blue-200'
                }`}
          >
            <div className="p-4">
              {/* ヘッダー部分 */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-sm font-medium
                                  ${
                                    selectedAnnotationId === annotation.id
                                      ? 'bg-blue-600'
                                      : 'bg-blue-500'
                                  }`}
                  >
                    {annotation.id}
                  </div>
                  <div
                    className={`ml-3 text-sm font-medium
                                  ${
                                    selectedAnnotationId === annotation.id
                                      ? 'text-blue-700'
                                      : 'text-gray-600 group-hover:text-blue-600'
                                  }`}
                  >
                    アノテーション {annotation.id}
                  </div>
                </div>
                <button
                  onClick={(e) => handleDelete(annotation.id, e)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-600"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>

              {/* コンテンツ部分 */}
              <div className="text-gray-700 text-sm pl-9">{annotation.content}</div>

              {/* アクションボタン */}
              <div className="mt-3 pl-9 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="text-xs text-blue-500 hover:text-blue-600 font-medium">
                  詳細を見る
                </button>
                <button className="text-xs text-gray-500 hover:text-gray-600 font-medium">
                  編集
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
