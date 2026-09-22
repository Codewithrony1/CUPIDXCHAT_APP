import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: [
    'better-sqlite3',
    '@prisma/adapter-better-sqlite3',
  ],
  typescript: {
    ignoreBuildErrors: false,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(self), geolocation=()',
          },
        ],
      },
      {
        source: '/(login|signup|register|dashboard|onboarding|setup-profile|sso-callback|auth-callback|chat/:path*|premium|api/:path*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          },
          {
            key: 'CDN-Cache-Control',
            value: 'no-store',
          },
          {
            key: 'Vercel-CDN-Cache-Control',
            value: 'no-store',
          },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: '/api/:path*',
      },
    ];
  },
  async redirects() {
    return [
      {
        source: '/sign-in',
        destination: '/login',
        permanent: false,
      },
      {
        source: '/sign-in/:path*',
        destination: '/login',
        permanent: false,
      },
      {
        source: '/sign-up',
        destination: '/signup',
        permanent: false,
      },
      {
        source: '/sign-up/:path*',
        destination: '/signup',
        permanent: false,
      },
      {
        source: '/onboarding',
        destination: '/setup-profile',
        permanent: false,
      },
      {
        source: '/onboarding/:path*',
        destination: '/setup-profile',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
