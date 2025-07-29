// 入力フォームコンポーネント
import { useState } from 'react';
import { useTranslations } from 'next-intl';

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
        <div className="inline-block p-4 bg-blue-50 dark:bg-blue-900/30 rounded-full mb-4">
          <svg
            className="w-16 h-16 text-blue-500 dark:text-blue-400"
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
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">{t('title')}</h2>
        <p className="text-gray-600 dark:text-gray-300">{t('description')}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/manifest.json"
            className="w-full px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          />
          {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>

        <button
          type="submit"
          className="w-full px-4 py-2 text-white bg-blue-500 dark:bg-blue-600 hover:bg-blue-600 dark:hover:bg-blue-500 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors"
        >
          {t('submit')}
        </button>
      </form>

      <div className="mt-8 text-sm text-gray-500 dark:text-gray-400">
        <h3 className="font-medium mb-2">{t('sampleManifest')}:</h3>
        <ul className="space-y-2">
          <li>
            <button
              onClick={() => onSubmit('/manifests/sample-manifest.json')}
              className="text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300"
            >
              {t('sampleManifest1')}
            </button>
          </li>
          <li>
            <button
              onClick={() => onSubmit('/manifests/sample-manifest-with-annotations.json', 'annotations')}
              className="text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300"
            >
              {t('sampleManifest2')}
            </button>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default ManifestInput;
