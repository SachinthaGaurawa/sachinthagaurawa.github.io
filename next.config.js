/** @type {import('next').NextConfig} */
const nextConfig = {
  // General
  reactStrictMode: true,
  swcMinify: true,
  poweredByHeader: false,

  // (Optional) public env for future pages; safe to keep.
  env: {
    NEXT_PUBLIC_GALLERY_TITLE: 'Album — Sachintha Gaurawa',
  },

  // Not needed for an API-only app, but harmless if left.
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'img.youtube.com' },
      { protocol: 'https', hostname: 'i.ytimg.com' },
    ],
  },

  // Strong security headers (applies to any route your backend serves).
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com https://unpkg.com https://cdn.jsdelivr.net",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com https://unpkg.com",
              "img-src 'self' data: blob: https://images.unsplash.com https://img.youtube.com https://i.ytimg.com",
              "font-src 'self' https://fonts.gstatic.com",
              "connect-src 'self' *", // allows your GitHub Pages to call this API
              "frame-src https://www.youtube.com",
              "media-src 'self' blob:",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'self'",
              "upgrade-insecure-requests",
            ].join('; '),
          },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'X-XSS-Protection', value: '0' },
        ],
      },
    ];
  },

  // ❌ IMPORTANT: No rewrites here — this app IS the API.
  // If you add a rewrite that proxies /api/*, it will bypass your /api/ai route.

  // Fine for Node deployments
  output: 'standalone',
};

export default nextConfig;
