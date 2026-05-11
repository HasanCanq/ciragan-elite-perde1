/** @type {import('next').NextConfig} */

const securityHeaders = [
  // HSTS: tarayıcıya HTTPS zorunlu kıl (1 yıl), preload listesi için hazır
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains; preload',
  },
  // Clickjacking koruması
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN',
  },
  // MIME-type sniffing engelle
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  // Referrer bilgisini dış sitelere sızdırma
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  // Gereksiz browser API'lerini kapat
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(self "https://sandbox-api.iyzipay.com" "https://api.iyzipay.com")',
  },
  // XSS koruması (eski tarayıcılar için)
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block',
  },
  // Content Security Policy
  // 'unsafe-inline' ve 'unsafe-eval' Next.js + iyzico JS için gerekli.
  // İleride nonce-based CSP'ye geçiş hedeflenmeli.
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.iyzipay.com https://sandbox-api.iyzipay.com",
      "style-src 'self' 'unsafe-inline' https://*.iyzipay.com",
      "frame-src 'self' https://*.iyzipay.com https://sandbox-api.iyzipay.com",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.iyzipay.com https://sandbox-api.iyzipay.com",
      "img-src 'self' data: blob: https://*.supabase.co https://www.google.com",
      "font-src 'self' data:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self' https://*.iyzipay.com https://sandbox-api.iyzipay.com",
      "frame-ancestors 'self'",
      "upgrade-insecure-requests",
    ].join('; '),
  },
];

const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
    // iyzipay paketi __dirname ile resources/ klasörünü bulur.
    // Next.js bundle'ı bu klasörü kopyalamaz; paketi external bırakarak
    // runtime'da node_modules'dan require edilmesini sağlıyoruz.
    serverComponentsExternalPackages: ['iyzipay'],
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
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
