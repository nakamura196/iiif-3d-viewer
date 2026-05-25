// 入力フォームコンポーネント
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { buttonClass } from '@nakamura196/react-ui';

const ManifestInput = ({ onSubmit }: { onSubmit: (url: string, tab?: string) => void }) => {
  const t = useTranslations('Input');
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
    <div className="max-w-md w-full mx-auto px-4">
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

      <div className="mt-8 text-sm text-[var(--ds-fg-muted)]">
        <h3 className="font-medium mb-2">{t('sampleManifest')}:</h3>
        <ul className="space-y-2 text-left">
          <li>
            <button
              onClick={() => onSubmit('/manifests/sample-manifest.json')}
              className="text-left text-[var(--ds-primary)] hover:underline"
            >
              {t('sampleManifest1')}
            </button>
          </li>
          <li>
            <button
              onClick={() => onSubmit('/manifests/sample-manifest-with-annotations.json', 'annotations')}
              className="text-left text-[var(--ds-primary)] hover:underline"
            >
              {t('sampleManifest2')}
            </button>
          </li>
          <li>
            <Link
              href={`/georef?manifest=${encodeURIComponent('/manifests/sample-manifest-with-annotations.json')}`}
              className="text-[var(--ds-primary)] hover:underline"
            >
              {t('sampleManifest3')}
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default ManifestInput;
