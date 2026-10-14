'use client';

import MarkdownPage from './MarkdownPage';

interface TermsContentProps {
  content: string;
}

export default function TermsContent({ content }: TermsContentProps) {
  return <MarkdownPage content={content} />;
}
