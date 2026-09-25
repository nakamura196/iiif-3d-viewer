import type { Metadata } from 'next';
import '../globals.css';
import Provider from '@/context/provider';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { SITE_URL, alternatesFor } from '@/lib/site';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  // 公開 URL は src/lib/site.ts。旧 github.io / vercel.app はそれぞれの設定で 3d.ldas.jp へ転送する。
  const baseUrl = SITE_URL;

  const title = locale === 'ja' ? 'IIIF 3D ビューア' : 'IIIF 3D Viewer';
  const description =
    locale === 'ja'
      ? 'IIIF Manifestに基づいた3Dモデルの表示とアノテーション機能を提供するビューアアプリケーション'
      : 'A viewer application that provides 3D model display and annotation functionality based on IIIF Manifest';

  return {
    title: {
      default: title,
      template: `%s | ${title}`,
    },
    description,
    keywords: ['IIIF', '3D', 'viewer', 'annotation', 'GLB', 'model', 'digital humanities'],
    authors: [{ name: 'Satoru Nakamura' }, { name: 'Jun Ogawa' }],
    creator: 'Satoru Nakamura, Jun Ogawa',
    publisher: 'Satoru Nakamura, Jun Ogawa',
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
    metadataBase: new URL(baseUrl),
    // 既定はロケールのトップ (/ja/, /en/)。下層ページは各 page.tsx の generateMetadata で上書きする。
    // / はブラウザ側で /ja/ へ移るだけのページ
    alternates: alternatesFor(locale, ''),
    openGraph: {
      title,
      description,
      url: `${baseUrl}/${locale}/`,
      siteName: title,
      images: [
        {
          url: '/opengraph-image.png',
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      locale: locale === 'ja' ? 'ja_JP' : 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title,
      description,
      site: '@satoru196',
      images: ['/twitter-image.png'],
      creator: '@satoru196',
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    // No explicit `icons` here: that would override Next's file-based icon
    // convention. We rely on src/app/icon.svg + apple-icon.png (the custom
    // 3D-cube branding), which Next links automatically with the basePath
    // applied. The stock public/favicon.ico is intentionally not referenced.
  };
}

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  // Ensure that the incoming `locale` is valid
  if (!routing.locales.includes(locale as 'en' | 'ja')) {
    notFound();
  }

  // Enable static rendering
  setRequestLocale(locale);

  const messages = await getMessages();

  return (
    <Provider>
      <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
    </Provider>
  );
}

export function generateStaticParams() {
  return [{ locale: 'en' }, { locale: 'ja' }];
}
