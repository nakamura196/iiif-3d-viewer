'use client';

import { sanitizeAboutHtml, type AboutMetadataItem } from '../../core';

// 資料の側が書いた HTML は、必ずここを通して出す。
// sanitizeAboutHtml が許可リスト以外のタグ・属性・URL を取り除いた結果だけを使う。
// リンクは周りの文字と見分けがつくよう、色と下線を付ける（付けないと文字だけに見える）。
export const LINK_CLASS = '[&_a]:text-blue-600 dark:[&_a]:text-blue-400 [&_a]:underline';

export function SafeHtml({ html, as: Tag = 'span', className }: { html: string; as?: 'span' | 'div'; className?: string }) {
  return (
    <Tag
      className={className ? `${LINK_CLASS} ${className}` : LINK_CLASS}
      dangerouslySetInnerHTML={{ __html: sanitizeAboutHtml(html) }}
    />
  );
}

// ラベルと値（値は複数でもよい）の一覧。値の HTML は無害化して出す。
export function MetadataList({ items }: { items: AboutMetadataItem[] }) {
  if (items.length === 0) return null;
  return (
    <dl className="space-y-2">
      {items.map((item, i) => (
        <div key={i}>
          {item.label && <dt className="font-medium text-gray-700 dark:text-gray-300">{item.label}</dt>}
          {item.html.map((h, j) => (
            <dd key={j} className="text-gray-900 dark:text-gray-100 break-words">
              <SafeHtml html={h} />
            </dd>
          ))}
        </div>
      ))}
    </dl>
  );
}
