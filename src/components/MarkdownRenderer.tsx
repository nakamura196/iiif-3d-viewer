'use client';

interface MarkdownRendererProps {
  content: string;
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const renderMarkdown = (markdown: string) => {
    const lines = markdown.split('\n');
    const elements: React.ReactNode[] = [];
    let currentList: string[] = [];
    let key = 0;

    const flushList = () => {
      if (currentList.length > 0) {
        elements.push(
          <ul key={key++} className="space-y-2 my-4">
            {currentList.map((item, index) => (
              <li key={index} className="flex items-start text-gray-600 dark:text-gray-300">
                <svg
                  className="w-5 h-5 text-blue-500 dark:text-blue-400 mr-3 mt-0.5 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        );
        currentList = [];
      }
    };

    for (const line of lines) {
      // Heading 1
      if (line.startsWith('# ')) {
        flushList();
        elements.push(
          <h1 key={key++} className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-4">
            {line.slice(2)}
          </h1>
        );
      }
      // Heading 2
      else if (line.startsWith('## ')) {
        flushList();
        elements.push(
          <h2 key={key++} className="text-xl font-semibold text-gray-800 dark:text-gray-100 mt-6 mb-3">
            {line.slice(3)}
          </h2>
        );
      }
      // Heading 3
      else if (line.startsWith('### ')) {
        flushList();
        elements.push(
          <h3 key={key++} className="text-lg font-semibold text-gray-800 dark:text-gray-100 mt-4 mb-2">
            {line.slice(4)}
          </h3>
        );
      }
      // Horizontal rule
      else if (line.startsWith('---')) {
        flushList();
        elements.push(<hr key={key++} className="my-6 border-gray-200 dark:border-gray-700" />);
      }
      // List item
      else if (line.startsWith('- ')) {
        currentList.push(line.slice(2));
      }
      // Paragraph
      else if (line.trim() !== '') {
        flushList();
        elements.push(
          <p key={key++} className="text-gray-600 dark:text-gray-300 my-3">
            {line}
          </p>
        );
      }
    }

    flushList();
    return elements;
  };

  return <div className="prose-container">{renderMarkdown(content)}</div>;
}
