import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Redis'i sadece env var varsa oluştur — yoksa null döner (graceful degrade)
function createRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
}

const redis = createRedis();

// Stub: Redis yoksa her isteğe izin ver
const ALLOW_ALL = {
  limit: async (_identifier: string) => ({
    success: true,
    limit: 999,
    remaining: 999,
    reset: 0,
    pending: Promise.resolve(),
  }),
};

type AnyLimiter = Pick<Ratelimit, 'limit'>;

function makeLimiter(
  algorithm: ReturnType<typeof Ratelimit.slidingWindow>,
  prefix: string
): AnyLimiter {
  if (!redis) return ALLOW_ALL;
  return new Ratelimit({ redis, limiter: algorithm, prefix });
}

// Genel sayfa istekleri: 30 istek / 10 saniye (bot koruması)
export const generalLimiter = makeLimiter(Ratelimit.slidingWindow(30, '10 s'), 'rl:general');

// Auth endpoint'leri: 5 istek / 60 saniye (brute force koruması)
export const authLimiter = makeLimiter(Ratelimit.slidingWindow(5, '60 s'), 'rl:auth');

// API/Sipariş rotaları IP bazlı: 10 istek / 10 saniye
export const apiLimiter = makeLimiter(Ratelimit.slidingWindow(10, '10 s'), 'rl:api');

// Sipariş: kullanıcı ID bazlı — aynı hesap max 5 sipariş / dakika
export const orderLimiter = makeLimiter(Ratelimit.slidingWindow(5, '60 s'), 'rl:order');

// Fiyat hesaplama: IP / kullanıcı bazlı — 30 istek / 60 saniye
export const calcLimiter = makeLimiter(Ratelimit.slidingWindow(30, '60 s'), 'rl:calc');
