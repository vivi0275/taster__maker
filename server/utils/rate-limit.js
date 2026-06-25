import { Redis } from '@upstash/redis';

const memoryBuckets = new Map();
let redisClient = null;

function getRedis() {
  if (redisClient) return redisClient;
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  redisClient = new Redis({ url, token });
  return redisClient;
}

export function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return String(forwarded).split(',')[0].trim();
  }
  return req.socket?.remoteAddress ?? 'unknown';
}

export async function enforceRateLimit(req, res, { name, max, windowSec = 60 }) {
  const ip = getClientIp(req);
  const key = `ratelimit:${name}:${ip}`;

  const redis = getRedis();
  if (redis) {
    try {
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, windowSec);
      }
      if (count > max) {
        res.setHeader('Retry-After', String(windowSec));
        res.status(429).json({ error: 'Too many requests. Please slow down.' });
        return false;
      }
      return true;
    } catch {
      // fall through to in-memory limiter
    }
  }

  const now = Date.now();
  const memKey = `${name}:${ip}`;
  let bucket = memoryBuckets.get(memKey);
  if (!bucket || now - bucket.start > windowSec * 1000) {
    bucket = { start: now, count: 0 };
    memoryBuckets.set(memKey, bucket);
  }
  bucket.count += 1;
  if (bucket.count > max) {
    res.setHeader('Retry-After', String(windowSec));
    res.status(429).json({ error: 'Too many requests. Please slow down.' });
    return false;
  }
  return true;
}

export function rateLimit(options) {
  return async (req, res, next) => {
    const ok = await enforceRateLimit(req, res, options);
    if (ok) next();
  };
}
