const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  fallbacks: {
    document: '/offline',
  },
  runtimeCaching: [
    // Fontshare CDN — Cache First, 1 year
    {
      urlPattern: /^https:\/\/api\.fontshare\.com\/.*/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'fontshare-fonts',
        expiration: { maxEntries: 10, maxAgeSeconds: 365 * 24 * 60 * 60 },
      },
    },
    // Static assets (JS, CSS, images, fonts) — Cache First
    {
      urlPattern: /\.(?:js|css|woff2?|png|jpg|jpeg|svg|ico|webp)$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'static-assets',
        expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 },
      },
    },
    // Auth endpoints — Network Only (never cache)
    {
      urlPattern: /\/api\/auth\/.*/,
      handler: 'NetworkOnly',
    },
    // API routes — Network First, 60s cache fallback
    {
      urlPattern: /\/api\/.*/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-cache',
        expiration: { maxEntries: 50, maxAgeSeconds: 60 },
        networkTimeoutSeconds: 10,
      },
    },
    // Pages — Stale While Revalidate
    {
      urlPattern: /^https?.*/,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'page-cache',
        expiration: { maxEntries: 50, maxAgeSeconds: 24 * 60 * 60 },
      },
    },
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  experimental: {
    serverActions: { bodySizeLimit: '2mb' },
  },
};

module.exports = withPWA(nextConfig);
