import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';

export default function Footer() {
  const t = useTranslations('Footer');
  const locale = useLocale();
  return (
    <footer className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 border-t border-gray-200/50 dark:border-gray-700/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand Section */}
          <div className="text-center md:text-left">
            <h3 className="text-lg font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
              {t('title')}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              © {new Date().getFullYear()} All rights reserved
            </p>
          </div>

          {/* Links Section */}
          <div className="text-center">
            <nav className="flex justify-center space-x-6">
              <Link 
                href={`/${locale}/help`} 
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200 relative group"
              >
                {t('help')}
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-600 dark:bg-blue-400 transition-all duration-200 group-hover:w-full"></span>
              </Link>
              <Link
                href={`/${locale}/privacy`}
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200 relative group"
              >
                {t('privacy')}
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-600 dark:bg-blue-400 transition-all duration-200 group-hover:w-full"></span>
              </Link>
              <Link 
                href={`/${locale}/terms`} 
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200 relative group"
              >
                {t('terms')}
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-600 dark:bg-blue-400 transition-all duration-200 group-hover:w-full"></span>
              </Link>
            </nav>
          </div>

          {/* Developers Section */}
          <div className="text-center md:text-right">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              {t('developedBy')}
            </p>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
              {t('developers')}
            </p>
          </div>
        </div>

        {/* Decorative Line */}
        <div className="mt-8 pt-6 border-t border-gray-200/30 dark:border-gray-700/30">
          <div className="flex justify-center space-x-2">
            <div className="w-1 h-1 bg-gray-400 dark:bg-gray-600 rounded-full"></div>
            <div className="w-1 h-1 bg-gray-400 dark:bg-gray-600 rounded-full"></div>
            <div className="w-1 h-1 bg-gray-400 dark:bg-gray-600 rounded-full"></div>
          </div>
        </div>
      </div>
    </footer>
  );
}
