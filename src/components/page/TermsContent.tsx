'use client';

import CommonLayout from '@/components/layout/Common';
import PageContainer from '@/components/layout/PageContainer';
import { MarkdownContent } from '@nakamura196/react-ui';

interface TermsContentProps {
  content: string;
}

export default function TermsContent({ content }: TermsContentProps) {
  return (
    <CommonLayout>
      <PageContainer width="text">
        <div className="bg-[var(--ds-surface)] rounded-lg shadow-sm border border-[var(--ds-border)] p-8">
          <MarkdownContent content={content} />
        </div>
      </PageContainer>
    </CommonLayout>
  );
}
