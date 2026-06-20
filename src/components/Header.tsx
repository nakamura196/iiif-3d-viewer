'use client';

import { useAtom } from 'jotai';
import { manifestUrlAtom } from '@/atoms/infoPanelAtom';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import { Link } from '@/i18n/routing';
import { ThemeToggle, LanguageSwitcher, buttonClass } from '@nakamura196/react-ui';

const Header = () => {
  const [manifestUrl, setManifestUrl] = useAtom(manifestUrlAtom);
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations('Header');

  const handleHomeClick = () => {
    setManifestUrl(null);
  };

  const changeLanguage = (newLocale: string) => {
    // 現在のパスから言語部分を除去
    const currentPath = pathname.replace(/^\/[^\/]+/, '');

    // クエリパラメータを維持
    const searchParams = new URLSearchParams(window.location.search);
    const queryString = searchParams.toString();

    // 新しいパスを構築
    const newPath = `/${newLocale}${currentPath}`;
    const fullPath = queryString ? `${newPath}?${queryString}` : newPath;

    router.push(fullPath);
  };

  return (
    <header className="h-14 bg-[var(--ds-bg)] border-b border-[var(--ds-border)] flex items-center px-3 sm:px-6 justify-between">
      <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
        <Link
          href="/"
          onClick={handleHomeClick}
          className="hover:opacity-80 transition-opacity shrink-0 flex items-center"
        >
          <h1
            className="text-lg sm:text-xl font-semibold text-[var(--ds-primary)] leading-none"
            style={{ fontFamily: 'var(--ds-font-serif)' }}
          >
            {t('title')}
          </h1>
        </Link>
        {manifestUrl && (
          <Link
            href="/"
            onClick={handleHomeClick}
            className="px-3 py-1.5 text-sm text-[var(--ds-fg-muted)] bg-[var(--ds-surface)] rounded-md hover:bg-[var(--ds-surface-2)] hover:text-[var(--ds-fg)] transition-colors flex items-center gap-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className="hidden sm:inline">{t('home')}</span>
          </Link>
        )}
      </div>
      <div className="flex items-center space-x-2 sm:space-x-3 ml-2 shrink-0">
        <ThemeToggle />

        <LanguageSwitcher
          current={locale}
          onChange={changeLanguage}
          locales={[
            { code: 'ja', label: '日本語' },
            { code: 'en', label: 'English' },
          ]}
        />

        {manifestUrl && (
          // The manifest URL is a static asset / external URL already carrying
          // the basePath, not an in-app route. Use a plain <a> so next/link
          // does not prepend basePath a second time (which 404s on GH Pages).
          <a
            href={manifestUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClass('primary', 'sm', 'whitespace-nowrap')}
          >
            <span className="hidden sm:inline">{t('download')}</span>
            <span className="sm:hidden">{t('downloadShort')}</span>
          </a>
        )}
      </div>
    </header>
  );
};

export default Header;
