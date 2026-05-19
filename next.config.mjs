import nextPWA from "next-pwa";

const withPWA = nextPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  fallbacks: {
    document: "/offline.html"
  },
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/fonts\.(?:gstatic|googleapis)\.com\/.*/i,
      handler: "CacheFirst",
      options: {
        cacheName: "google-fonts",
        expiration: { maxEntries: 8, maxAgeSeconds: 365 * 24 * 60 * 60 }
      }
    },
    {
      urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
      handler: "CacheFirst",
      options: {
        cacheName: "crunch-watcher-images",
        expiration: { maxEntries: 64, maxAgeSeconds: 30 * 24 * 60 * 60 }
      }
    },
    {
      urlPattern: /\.(?:js|css)$/i,
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "crunch-watcher-static",
        expiration: { maxEntries: 64, maxAgeSeconds: 7 * 24 * 60 * 60 }
      }
    },
    {
      urlPattern: ({ url }) => url.origin === self.location.origin,
      handler: "NetworkFirst",
      options: {
        cacheName: "crunch-watcher-pages",
        networkTimeoutSeconds: 3,
        expiration: { maxEntries: 32, maxAgeSeconds: 7 * 24 * 60 * 60 }
      }
    }
  ]
});

/** @type {import('next').NextConfig} */
const nextConfig = {};

export default withPWA(nextConfig);
