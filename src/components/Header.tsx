'use client';

import { useAtom } from 'jotai';
import { manifestUrlAtom } from '@nakamura196/iiif-viewer';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import { Link } from '@/i18n/routing';
import { ThemeToggle, LanguageSwitcher, buttonClass } from '@nakamura196/react-ui';

// compact: ビューアのように表示領域を広く取りたいページでは、帯を細くする
const Header = ({ compact = false }: { compact?: boolean }) => {
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
    <header className={`${compact ? 'h-10' : 'h-14'} shrink-0 bg-[var(--ds-bg)] border-b border-[var(--ds-border)] flex items-center px-3 sm:px-6 justify-between`}>
      <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
        <Link
          href="/"
          onClick={handleHomeClick}
          className="hover:opacity-80 transition-opacity shrink-0 flex items-center"
        >
          <h1
            className={`${compact ? 'text-base sm:text-lg' : 'text-lg sm:text-xl'} font-semibold text-[var(--ds-primary)] leading-none`}
            style={{ fontFamily: 'var(--ds-font-serif)' }}
          >
            {t('title')}
          </h1>
        </Link>
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
