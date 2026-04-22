import type { NextConfig } from "next";
import path from "path";
const withPWA = require("@ducanh2912/next-pwa").default({
  dest: "public",
  sw: "sw.js", // The generated SW name
  disable: false, // Temporarily enabled for local testing
  workboxOptions: {
    importScripts: ['/custom-sw.js']
  }
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
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
};

export default withPWA(config);
