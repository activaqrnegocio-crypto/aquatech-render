import type { NextConfig } from "next";
import path from "path";
const withPWA = require("@ducanh2912/next-pwa").default({
  dest: "public",
  sw: "sw.js", // The generated SW name
  customWorkerDir: "public", // Where custom-sw.js is
  disable: process.env.NODE_ENV === "development",
  // We don't want it to cache everything automatically, as we have a custom-sw.js
  // that handles the complex logic. next-pwa will mainly handle the manifest and build-time assets.
});

const config: NextConfig = {
  // Fix: Force correct workspace root to prevent Client Component resolution errors
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
