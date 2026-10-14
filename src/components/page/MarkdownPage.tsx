'use client';

import CommonLayout from '@/components/layout/Common';
import PageContainer from '@/components/layout/PageContainer';
import { MarkdownContent } from '@nakamura196/react-ui';

// ヘルプ・プライバシーポリシー・利用規約のような、文章を読ませるページ。
// 枠（カード）で囲まず、ページの地にそのまま文章を置く。
// MarkdownContent（prose-lg）の既定に、次を足している。
// - スマホでは文字を一段小さくする（prose-lg の h1 は 390px 幅では大きすぎる）
// - 長い URL を折り返す（そのままだと画面の外にはみ出す）
// - 見出し 2 の下に線を引き、節の区切りを見えるようにする
// - 線・箇条書きの印・区切り線の色をテーマの色にそろえる（ダークモードで浮かないように）
const docClass = [
  'max-sm:prose-base',
  'prose-h1:mb-6 prose-h1:text-3xl sm:prose-h1:text-4xl',
  'prose-h2:mt-12 prose-h2:pb-2 prose-h2:border-b prose-h2:border-[var(--ds-border)]',
  'prose-h3:mt-8',
  'prose-a:[overflow-wrap:anywhere]',
  'prose-li:marker:text-[var(--ds-fg-muted)]',
  'prose-hr:border-[var(--ds-border)]',
  'prose-code:text-[var(--ds-fg)] prose-code:before:content-none prose-code:after:content-none',
  'prose-code:bg-[var(--ds-surface-2)] prose-code:px-1 prose-code:rounded prose-code:font-normal prose-code:[overflow-wrap:anywhere]',
].join(' ');

export default function MarkdownPage({ content }: { content: string }) {
  return (
    <CommonLayout>
      <PageContainer width="text">
        <MarkdownContent content={content} className={docClass} />
      </PageContainer>
    </CommonLayout>
  );
}
