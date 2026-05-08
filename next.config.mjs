/** @type {import('next').NextConfig} */
const nextConfig = {
  // ESLint is not configured in this repo — skip it during `next build`
  // so Vercel deploys do not block on the interactive config prompt.
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    // These are loaded dynamically inside server-only modules.
    // Mark them external so Next does not try to bundle them
    // (puppeteer-core has require-dynamic that webpack mangles
    // and @sparticuz/chromium ships an LZ tarball Next would copy
    // incorrectly otherwise).
    serverComponentsExternalPackages: [
      'puppeteer-core',
      '@sparticuz/chromium',
      'puppeteer',
    ],
  },
};

export default nextConfig;
