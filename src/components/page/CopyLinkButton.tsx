'use client';

import { useEffect, useRef, useState } from 'react';
import { buttonClass } from '@nakamura196/react-ui';

// 今開いているページの URL をクリップボードへ入れる。押したら done を 2 秒出す。
// clipboard が使えない環境（http や古いブラウザ）でも、何も起きないだけで落とさない
export default function CopyLinkButton({ label, done }: { label: string; done: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      return;
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button type="button" onClick={copy} className={buttonClass('secondary', 'md')}>
      <span aria-live="polite">{copied ? done : label}</span>
    </button>
  );
}
