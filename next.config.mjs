/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  poweredByHeader: false,

  // Public env (not required by your API route, but fine to keep)
  env: {
    NEXT_PUBLIC_GALLERY_TITLE: 'Album — Sachintha Gaurawa',
  },

  // Not used by the API, but harmless if you ever add pages that show images
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'img.youtube.com' },
      { protocol: 'https', hostname: 'i.ytimg.com' },
    ],
  },

  // Security headers (applied to all responses, including API JSON)
  async headers() {
    // Note: CSP mainly matters for HTML pages; it does not block your server-side fetches.
    // We keep connect-src permissive to avoid accidental breakage.
    return.join('; '),
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

  // IMPORTANT: No rewrites here — this project IS your backend.
  // If you add a rewrite for /api/*, you will bypass app/api/ai/route.ts.

  output: 'standalone',
};

export default nextConfig;
