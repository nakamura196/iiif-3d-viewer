import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// GH Pages は project repo を `nakamura196.github.io/iiif-3d-viewer/` で配信するため
// basePath / assetPrefix のサブパス対応が必須。Vercel 用 build (root 配信) と両立
// させるため、GH Actions の deploy-pages workflow で GITHUB_PAGES=true を立てたとき
// だけサブパスを付ける。
const isGhPages = process.env.GITHUB_PAGES === 'true';
const basePath = isGhPages ? '/iiif-3d-viewer' : '';

/** @type {import('next').NextConfig} */
const nextConfig = {
  trailingSlash: true,
  output: 'export',
  basePath,
  assetPrefix: isGhPages ? `${basePath}/` : '',
  transpilePackages: ['@nakamura196/react-ui'],
};

export default withNextIntl(nextConfig);
