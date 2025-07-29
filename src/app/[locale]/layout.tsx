import type { Metadata } from 'next';
import localFont from 'next/font/local';
import '../globals.css';
import Provider from '@/context/provider';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';

const geistSans = localFont({
  src: '../fonts/GeistVF.woff',
  variable: '--font-geist-sans',
  weight: '100 900',
});
const geistMono = localFont({
  src: '../fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono',
  weight: '100 900',
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = 'https://3d-iiif-viewer.vercel.app';

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
    alternates: {
      canonical: '/',
      languages: {
        en: '/en',
        ja: '/ja',
      },
    },
    openGraph: {
      title,
      description,
      url: baseUrl,
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
    icons: {
      icon: '/favicon.ico',
    },
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
    <html lang={locale}>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Provider>
          <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
        </Provider>
      </body>
    </html>
  );
}

export function generateStaticParams() {
  return [{ locale: 'en' }, { locale: 'ja' }];
}
