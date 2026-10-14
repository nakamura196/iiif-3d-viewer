// ページ本文の外枠。幅と余白はここだけで決め、ページごとに書かない
// - wide: トップ・一覧のページ（カードを並べて見せる）
// - text: 文章を読ませるページ（ヘルプ・規約）。行が長すぎると読みにくいので狭くする
// ビューア・比較・検索結果のような、画面いっぱいに使うページはこれを使わない
const WIDTHS = {
  wide: 'max-w-6xl',
  text: 'max-w-3xl',
} as const;

export default function PageContainer({
  width = 'wide',
  className = '',
  children,
}: {
  width?: keyof typeof WIDTHS;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-[60vh] px-4 py-8 sm:px-8 sm:py-12 bg-[var(--ds-bg)]">
      <div className={`${WIDTHS[width]} mx-auto ${className}`.trim()}>{children}</div>
    </div>
  );
}
