// 入力フォームコンポーネント
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { buttonClass } from '@nakamura196/react-ui';
import { FEATURED_USE_CASES, hrefOf, thumbnailOf } from '@/lib/usecases';

const ManifestInput = ({ onSubmit }: { onSubmit: (url: string, tab?: string) => void }) => {
  const t = useTranslations('Input');
  const locale = useLocale() === 'en' ? 'en' : 'ja';
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) {
      setError(t('requiredUrl'));
      return;
    }
    try {
      new URL(url);
      setError('');
      onSubmit(url);
    } catch {
      setError(t('invalidUrl'));
    }
  };

  return (
    <div className="w-full">
      <div className="max-w-md mx-auto">
        <div className="mb-8 text-center">
          <div className="inline-block p-4 bg-[var(--ds-surface-2)] rounded-full mb-4">
            <svg
              className="w-16 h-16 text-[var(--ds-primary)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>
          <h2
            className="text-2xl font-bold text-[var(--ds-fg)] mb-2"
            style={{ fontFamily: 'var(--ds-font-serif)' }}
          >
            {t('title')}
          </h2>
          <p className="text-[var(--ds-fg-muted)]">{t('description')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/manifest.json"
              className="w-full px-4 py-2 rounded-md border border-[var(--ds-border)] bg-[var(--ds-bg)] text-[var(--ds-fg)] placeholder-[var(--ds-fg-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-ring)]"
            />
            {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
          </div>

          <button type="submit" className={buttonClass('primary', 'md', 'w-full')}>
            {t('submit')}
          </button>
        </form>
      </div>

      <div className="mt-8 text-sm text-[var(--ds-fg-muted)]">
        <h3 className="font-medium mb-2">{t('sampleManifest')}:</h3>
        {/* 開いたときの画面（サムネイル）つきで並べ、何ができるかを見せる */}
        <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-left">
          {FEATURED_USE_CASES.map((u) => (
            <li key={u.id}>
              <Link
                href={hrefOf(u.open)}
                className="group block h-full rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface)] overflow-hidden hover:border-[var(--ds-primary)]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- 静的書き出しのため next/image は使わない */}
                <img
                  src={thumbnailOf(u)}
                  alt=""
                  width={640}
                  height={400}
                  loading="lazy"
                  className="w-full aspect-[16/10] object-cover bg-[var(--ds-surface-2)]"
                />
                <span className="block p-2 text-[var(--ds-primary)] group-hover:underline">{u.title[locale]}</span>
              </Link>
            </li>
          ))}
        </ul>
        {/* 一覧ページへの入口。ユースケースとサンプルはボタンで目立たせ、検索は文字のリンクのまま */}
        <div className="mt-6 grid sm:grid-cols-2 gap-3">
          <Link href="/usecases" className={buttonClass('primary', 'lg', 'w-full')}>
            {t('sampleUseCasesAll')}
          </Link>
          <Link href="/samples" className={buttonClass('secondary', 'lg', 'w-full')}>
            {t('sampleManifestAll')}
          </Link>
        </div>
        <p className="mt-4 text-left">
          <Link href="/search" className="text-[var(--ds-primary)] hover:underline">
            {t('searchCollection')}
          </Link>
        </p>
      </div>
    </div>
  );
};

export default ManifestInput;
