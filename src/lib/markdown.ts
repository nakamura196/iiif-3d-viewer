import fs from 'fs';
import path from 'path';

export function getMarkdownContent(locale: string, page: string): string {
  const filePath = path.join(process.cwd(), 'src', 'content', locale, `${page}.md`);

  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    // Fallback to Japanese if locale file not found
    const fallbackPath = path.join(process.cwd(), 'src', 'content', 'ja', `${page}.md`);
    return fs.readFileSync(fallbackPath, 'utf8');
  }
}
