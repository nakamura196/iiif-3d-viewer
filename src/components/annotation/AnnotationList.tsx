import { annotationsAtom, selectedAnnotationIdAtom } from '@/atoms/infoPanelAtom';
import { useAtom } from 'jotai';
import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';

export default function AnnotationList() {
  const t = useTranslations('Annotation');
  const [annotations] = useAtom(annotationsAtom);
  const [selectedAnnotationId, setSelectedAnnotationId] = useAtom(selectedAnnotationIdAtom);
  const selectedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedAnnotationId && selectedRef.current) {
      selectedRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  }, [selectedAnnotationId]);

  const focusOnAnnotation = (annotationId: string) => {
    setSelectedAnnotationId(annotationId);
  };

  return (
    <div className="p-6 bg-white dark:bg-gray-900">
      <h2 className="text-xl font-bold mb-6 text-gray-800 dark:text-gray-100">
        {t('annotations')}
      </h2>
      <div className="mb-4 text-gray-500 dark:text-gray-400">
        {t('annotationCount', { count: annotations.length })}
      </div>
      <div className="space-y-4">
        {annotations.map((annotation, index) => (
          <div
            key={annotation.id}
            ref={selectedAnnotationId === annotation.id ? selectedRef : null}
            onClick={() => focusOnAnnotation(annotation.id)}
            className={`group rounded-lg shadow-sm hover:shadow-md transition-all duration-200 
                cursor-pointer border overflow-hidden
                ${
                  selectedAnnotationId === annotation.id
                    ? 'bg-blue-50 dark:bg-blue-900 border-blue-300 dark:border-blue-700'
                    : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-600'
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
                    {index + 1}
                  </div>
                  <div
                    className={`ml-3 text-sm font-medium
                                  ${
                                    selectedAnnotationId === annotation.id
                                      ? 'text-blue-700 dark:text-blue-300'
                                      : 'text-gray-600 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400'
                                  }`}
                  >
                    {annotation.data.body.label}
                  </div>
                </div>
                <div className="mt-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Type: {annotation.data?.target?.selector?.type || '不明'}
                  </span>
                </div>
              </div>

              {/* コンテンツ部分 */}
              <div
                className="text-gray-700 dark:text-gray-300 text-sm pl-9"
                dangerouslySetInnerHTML={{ __html: annotation.data.body.value }}
              />

              {/* アクションボタン */}
              {/*
              <div className="mt-3 pl-9 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="text-xs text-blue-500 hover:text-blue-600 font-medium">
                  詳細を見る
                </button>
              </div>
              */}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
