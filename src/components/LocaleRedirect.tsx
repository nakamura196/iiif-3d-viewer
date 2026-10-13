'use client';

import { useEffect } from 'react';
import { localizedUrl, pickLocale } from '@/lib/locale';

// 静的書き出しなのでサーバ側で振り分けられない。ブラウザの希望言語を見て、
// 同じページの /en/ か /ja/ に移す。クエリ (?iiif-content=...) と # は引き継ぐ。
// replace にするのは、戻るボタンでこのページに戻って再び飛ばされないようにするため。
export default function LocaleRedirect({ path }: { path: string }) {
  useEffect(() => {
    const languages = navigator.languages?.length ? navigator.languages : [navigator.language];
    const { search, hash } = window.location;
    window.location.replace(localizedUrl(pickLocale(languages), path, search, hash));
  }, [path]);

  // JavaScript が動かない環境・検索エンジン向けに、両方の言語へのリンクを出しておく。
  return (
    <noscript>
      <p>
        <a href={localizedUrl('en', path)}>English</a> / <a href={localizedUrl('ja', path)}>日本語</a>
      </p>
    </noscript>
  );
}
