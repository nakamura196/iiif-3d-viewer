'use client';

import { useAtom } from 'jotai';
import { manifestUrlAtom } from '@/atoms/infoPanelAtom';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import { Link } from '@/i18n/routing';
import NextLink from 'next/link';

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
    <header className="h-14 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center px-3 sm:px-6 justify-between">
      <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
        <Link
          href="/"
          onClick={handleHomeClick}
          className="hover:opacity-80 transition-opacity shrink-0 flex items-center"
        >
          <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 leading-none">
            {t('title')}
          </h1>
        </Link>
      </div>
      <div className="flex items-center space-x-2 sm:space-x-4 ml-2 shrink-0">
        <button
          onClick={() => changeLanguage(locale === 'ja' ? 'en' : 'ja')}
          className="px-3 sm:px-4 py-2 text-sm text-white bg-blue-500 rounded-md hover:bg-blue-600 cursor-pointer whitespace-nowrap"
        >
          {locale === 'ja' ? 'English' : '日本語'}
        </button>

        {manifestUrl && (
          <NextLink
            href={manifestUrl}
            target="_blank"
            className="px-3 sm:px-4 py-2 text-sm text-white bg-blue-500 rounded-md hover:bg-blue-600 whitespace-nowrap"
          >
            <span className="hidden sm:inline">{t('download')}</span>
            <span className="sm:hidden">{t('downloadShort')}</span>
          </NextLink>
        )}
      </div>
    </header>
  );
};

export default Header;
