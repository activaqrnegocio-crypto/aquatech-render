import type { NextConfig } from "next";
import path from "path";
const withPWA = require("@ducanh2912/next-pwa").default({
  dest: "public",
  sw: "sw.js",
  disable: true, // DISABLED: We use /custom-sw.js directly to avoid Workbox conflicts
  // The Workbox-generated sw.js was intercepting navigation requests with its
  // own route handlers that had no offline fallback, causing ERR_FAILED on
  // cold-start offline. Our custom-sw.js handles everything independently.
});

const config: NextConfig = {
  // Fix: Force correct workspace root to prevent Client Component resolution errors
  output: 'standalone',
  outputFileTracingRoot: path.resolve(__dirname),
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cesarweb.b-cdn.net',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: '*.googleusercontent.com',
      },
    ],
  },
  // Force correct MIME type for Service Worker files
  // Without this, standalone server serves .js files from public/ as text/plain
  // which causes Chrome to reject them as Service Workers
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/custom-sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
  // v373: Silence Next.js 16 Turbopack/webpack conflict error.
  // The next-pwa wrapper injects a webpack config internally, but Next 16 defaults to Turbopack.
  // An empty turbopack config tells Next.js we're aware and it's intentional.
  turbopack: {},
  experimental: {
    serverActions: {
      bodySizeLimit: '200mb',
    },
    staleTimes: {
      dynamic: 300,  // v338→v2: 5 min freshness — evita refetch al navegar entre pestañas
      static: 1800,  // 30 min para estático
    },
  },
};

export default withPWA(config);
