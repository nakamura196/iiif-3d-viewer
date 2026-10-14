'use client';

import MarkdownPage from './MarkdownPage';

interface PrivacyContentProps {
  content: string;
}

export default function PrivacyContent({ content }: PrivacyContentProps) {
  return <MarkdownPage content={content} />;
}
