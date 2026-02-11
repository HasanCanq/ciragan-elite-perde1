import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default withSentryConfig(nextConfig, {
  // Sentry org ve proje bilgileri
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Source map'leri Sentry'ye yukle ama client bundle'a ekleme
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },

  // Build loglarini gizle
  silent: !process.env.CI,

  // Performans: Otomatik server-side istek izleme
  autoInstrumentServerFunctions: true,

  // Tunnel: Ad-blocker'lari bypass et
  tunnelRoute: '/monitoring',
});
