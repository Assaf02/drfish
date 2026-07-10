const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
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
    // Static assets — Cache First
    {
      urlPattern: /\.(?:js|css|woff2?|png|jpg|jpeg|svg|ico|webp)$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'static-assets',
        expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 },
      },
    },
    // Auth — Network Only (never cache)
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
    // Pages — Network First
    {
      urlPattern: /^https?.*/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'page-cache',
        expiration: { maxEntries: 50, maxAgeSeconds: 24 * 60 * 60 },
        networkTimeoutSeconds: 15,
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
    serverComponentsExternalPackages: [
      '@whiskeysockets/baileys',
      'pino',
      'pino-pretty',
      'libsignal',
      'music-metadata',
      'ws',
    ],
  },
};

module.exports = withPWA(nextConfig);
