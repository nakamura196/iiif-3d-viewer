'use client';

import MarkdownPage from './MarkdownPage';

interface HelpContentProps {
  content: string;
}

export default function HelpContent({ content }: HelpContentProps) {
  return <MarkdownPage content={content} />;
}
