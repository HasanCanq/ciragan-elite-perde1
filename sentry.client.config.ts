import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performans izleme: production'da %20 oraninda ornekleme
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,

  // Session replay: hata aninda kullanici ekranini kaydet
  replaysSessionSampleRate: 0.1, // %10 normal session
  replaysOnErrorSampleRate: 1.0, // %100 hata aninda

  integrations: [
    Sentry.replayIntegration(),
  ],

  // Gelistirme ortaminda debug aktif
  debug: false,

  // Ortam bilgisi
  environment: process.env.NODE_ENV,
});
