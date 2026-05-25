'use client';

import CommonLayout from '@/components/layout/Common';
import { MarkdownContent } from '@nakamura196/react-ui';

interface HelpContentProps {
  content: string;
}

export default function HelpContent({ content }: HelpContentProps) {
  return (
    <CommonLayout>
      <div className="min-h-[60vh] p-8 bg-[var(--ds-bg)]">
        <div className="max-w-3xl mx-auto">
          <div className="bg-[var(--ds-surface)] rounded-lg shadow-sm border border-[var(--ds-border)] p-8">
            <MarkdownContent content={content} />
          </div>
        </div>
      </div>
    </CommonLayout>
  );
}
