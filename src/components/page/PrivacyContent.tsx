'use client';

import CommonLayout from '@/components/layout/Common';
import MarkdownRenderer from '@/components/MarkdownRenderer';

interface PrivacyContentProps {
  content: string;
}

export default function PrivacyContent({ content }: PrivacyContentProps) {
  return (
    <CommonLayout>
      <div className="min-h-[60vh] p-8 bg-white dark:bg-gray-900">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 p-8">
            <MarkdownRenderer content={content} />
          </div>
        </div>
      </div>
    </CommonLayout>
  );
}
