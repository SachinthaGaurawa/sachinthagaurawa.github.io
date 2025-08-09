/** @type {import('next').NextConfig} */
const nextConfig = {
    // General
    reactStrictMode: true,
    swcMinify: true,
    poweredByHeader: false,
  
    // Expose only non-sensitive values to the client (prefix NEXT_PUBLIC_ for runtime access).
    env: {
      NEXT_PUBLIC_GALLERY_TITLE: 'Album — Sachintha Gaurawa',
    },
  
    // Allow external images you use in cards/covers/thumbnails.
    images: {
      remotePatterns: [
        { protocol: 'https', hostname: 'images.unsplash.com' },
        { protocol: 'https', hostname: 'img.youtube.com' },
        { protocol: 'https', hostname: 'i.ytimg.com' },
      ],
    },
  
    // Strong default security headers (tweak if you add service workers, iframes, etc.)
    async headers() {
      return [
        {
          source: '/:path*',
          headers: [
            // Note: if you inline videos/iframes widely you may relax the CSP.
            {
              key: 'Content-Security-Policy',
              value: [
                "default-src 'self'",
                "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com https://unpkg.com https://cdn.jsdelivr.net",
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com https://unpkg.com",
                "img-src 'self' data: blob: https://images.unsplash.com https://img.youtube.com https://i.ytimg.com",
                "font-src 'self' https://fonts.gstatic.com",
                "connect-src 'self' *", // allow API calls during development; tighten in prod if you proxy
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
  
    // Optional: proxy /api/* to your separate Express server to avoid CORS in Next apps.
    // Set API_BASE in your .env/.env.local (e.g., http://localhost:8787 or https://album-ai-api.yourdomain.com)
    async rewrites() {
      const API_BASE = process.env.API_BASE?.trim();
      if (!API_BASE) return [];
      return [
        {
          source: '/api/:path*',
          destination: `${API_BASE}/api/:path*`,
        },
      ];
    },
  
    // For Docker or Node deploys:
    output: 'standalone',
  };
  
  export default nextConfig;
  
