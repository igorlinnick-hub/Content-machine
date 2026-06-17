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
      // ffmpeg-installer dynamically requires a platform-specific
      // package (linux-x64/darwin-arm64/…). Webpack mangles that
      // expression and Next's build-time "collecting page data"
      // step tries to resolve it eagerly, which fails when the
      // installer's per-platform sub-package isn't picked up by
      // npm's optionalDependencies on the current OS. External =
      // skip bundling, resolve at runtime from node_modules.
      '@ffmpeg-installer/ffmpeg',
    ],
    // Tell Vercel's serverless tracer to bundle the compliance .md
    // files alongside the /compliance route. Without this the docs
    // directory is stripped from the deploy and readFile() 500s.
    outputFileTracingIncludes: {
      '/compliance': ['./docs/**/*.md'],
    },
  },
};

export default nextConfig;
