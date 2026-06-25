import { Redis } from '@upstash/redis';

const CACHE_KEY = 'soundcloud:oauth';
const LOCK_KEY = 'soundcloud:oauth:refresh-lock';
const LOCK_TTL_SECONDS = 30;
const EXPIRY_BUFFER_MS = 60_000;

let redisClient = null;
let memoryCache = { token: null, refreshToken: null, expiresAt: 0 };

function getRedis() {
  if (redisClient) return redisClient;

  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  if (!url || !token) return null;

  redisClient = new Redis({ url, token });
  return redisClient;
}

export function isSharedTokenStoreConfigured() {
  return Boolean(getRedis());
}

function isCacheValid(cache) {
  return Boolean(cache?.token && Date.now() < cache.expiresAt - EXPIRY_BUFFER_MS);
}

function syncMemory(cache) {
  memoryCache = {
    token: cache.token,
    refreshToken: cache.refreshToken ?? null,
    expiresAt: cache.expiresAt,
  };
}

export async function readTokenCache() {
  const redis = getRedis();

  if (redis) {
    try {
      const data = await redis.get(CACHE_KEY);
      if (data?.token) {
        syncMemory(data);
        return data;
      }
    } catch {
      // fall through to memory
    }
  }

  return memoryCache.token ? memoryCache : null;
}

export async function writeTokenCache({ token, refreshToken, expiresAt }) {
  const payload = {
    token,
    refreshToken: refreshToken ?? null,
    expiresAt,
  };

  syncMemory(payload);

  const redis = getRedis();
  if (!redis) return;

  const ttlSeconds = Math.max(120, Math.floor((expiresAt - Date.now()) / 1000));

  try {
    await redis.set(CACHE_KEY, payload, { ex: ttlSeconds });
  } catch {
    // memory cache still updated for this instance
  }
}

export async function readValidAccessToken() {
  const cache = await readTokenCache();
  return isCacheValid(cache) ? cache.token : null;
}

export async function readStaleAccessToken() {
  const cache = await readTokenCache();
  return cache?.token ?? null;
}

export async function readRefreshToken() {
  const cache = await readTokenCache();
  return cache?.refreshToken ?? null;
}

export async function acquireRefreshLock() {
  const redis = getRedis();
  if (!redis) return true;

  try {
    const result = await redis.set(LOCK_KEY, String(Date.now()), { nx: true, ex: LOCK_TTL_SECONDS });
    return result === 'OK';
  } catch {
    return true;
  }
}

export async function releaseRefreshLock() {
  const redis = getRedis();
  if (!redis) return;

  try {
    await redis.del(LOCK_KEY);
  } catch {
    // ignore
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForValidAccessToken(maxAttempts = 12, delayMs = 500) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const token = await readValidAccessToken();
    if (token) return token;
    await sleep(delayMs);
  }
  return null;
}
