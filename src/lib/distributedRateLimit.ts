/**
 * Distributed rate limiting adapter (RL-001).
 *
 * Provides a drop-in replacement for the in-memory `checkRateLimit` /
 * `recordFailedAttempt` functions in `src/lib/rateLimit.ts` that persists
 * counters in Upstash Redis when the environment is configured, and gracefully
 * falls back to the existing in-memory implementation otherwise.
 *
 * This makes Redis **opt-in**: existing deployments continue to work without
 * any new environment variables. Once UPSTASH_REDIS_REST_URL and
 * UPSTASH_REDIS_REST_TOKEN are set, all Next.js API-route rate limiting
 * automatically becomes distributed and survives serverless cold starts.
 *
 * ## Setup (optional but recommended for production / Vercel)
 *
 * 1. Create a free Redis database at https://console.upstash.com
 * 2. Add to .env.local (or Vercel environment variables):
 *      UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
 *      UPSTASH_REDIS_REST_TOKEN=your-token
 * 3. Install dependencies:
 *      npm install @upstash/redis @upstash/ratelimit
 *
 * Without step 2-3, the module falls back to in-memory automatically.
 */

import {
  checkRateLimit,
  recordFailedAttempt,
  clearRateLimit,
  type RateLimitResult,
} from './rateLimit';

// ── Upstash adapter (loaded lazily to avoid import errors when package is absent) ──

let _redis: unknown = null;
let _Ratelimit: unknown = null;
let _redimLoaded = false;

async function tryLoadUpstash(): Promise<boolean> {
  if (_redimLoaded) return _redis !== null;
  _redimLoaded = true;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return false;

  try {
    // Dynamic imports with inline type suppression — packages are optional.
    // Install them to enable distributed rate limiting:
    //   npm install @upstash/redis @upstash/ratelimit
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const redisModule = await (import('@upstash/redis' as string) as Promise<any>).catch(() => null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ratelimitModule = await (import('@upstash/ratelimit' as string) as Promise<any>).catch(() => null);

    if (!redisModule || !ratelimitModule) return false;

    _redis = new redisModule.Redis({ url, token });
    _Ratelimit = ratelimitModule.Ratelimit;
    return true;
  } catch {
    return false;
  }
}

// Cache of Ratelimit instances (keyed by `${max}:${windowMs}`)
const limiterCache = new Map<string, unknown>();

async function getUpstashLimiter(
  max: number,
  windowMs: number
): Promise<unknown | null> {
  if (!(await tryLoadUpstash()) || !_redis || !_Ratelimit) return null;

  const cacheKey = `${max}:${windowMs}`;
  if (limiterCache.has(cacheKey)) return limiterCache.get(cacheKey)!;

  const windowSec = Math.ceil(windowMs / 1000);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const RatelimitClass = _Ratelimit as any;
  const limiter = new RatelimitClass({
    redis: _redis,
    limiter: RatelimitClass.slidingWindow(max, `${windowSec}s`),
    analytics: false,
  });
  limiterCache.set(cacheKey, limiter);
  return limiter;
}

/**
 * Checks a rate limit key using Upstash Redis (if configured) or falls back
 * to the in-memory implementation.
 *
 * Drop-in replacement for `checkRateLimit` from `./rateLimit`.
 */
export async function checkRateLimitDistributed(
  key: string,
  maxAttempts = 5,
  windowMs = 15 * 60 * 1000
): Promise<RateLimitResult> {
  const limiter = await getUpstashLimiter(maxAttempts, windowMs);

  if (limiter) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (limiter as any).limit(key);
      const retryAfter = result.reset
        ? Math.max(0, Math.ceil((result.reset - Date.now()) / 1000))
        : 0;
      return {
        isBlocked: !result.success,
        retryAfterSeconds: result.success ? 0 : retryAfter,
        limit: maxAttempts,
        remaining: Math.max(0, result.remaining ?? 0),
        resetTime: result.reset ?? Date.now() + windowMs,
      };
    } catch (err) {
      // Redis error — degrade gracefully to in-memory
      console.warn('[distributedRateLimit] Upstash error, falling back to in-memory:', err);
    }
  }

  // Fallback: in-memory rate limiter (single-instance only)
  return checkRateLimit(key, maxAttempts, windowMs);
}

/**
 * Records a failed attempt. When Upstash is active, counting is handled
 * automatically by `checkRateLimitDistributed`. This is a no-op for Redis
 * (sliding window handles it) and delegates to the in-memory tracker otherwise.
 */
export async function recordFailedAttemptDistributed(
  key: string,
  windowMs = 15 * 60 * 1000,
  blockThreshold = 5
): Promise<void> {
  if (await tryLoadUpstash() && _redis) {
    // Upstash sliding window counters are incremented on every `limit()` call;
    // no separate "record" step is needed.
    return;
  }
  recordFailedAttempt(key, windowMs, blockThreshold);
}

/**
 * Clears a rate limit key. Best-effort for Redis (key TTL will expire naturally).
 */
export async function clearRateLimitDistributed(key: string): Promise<void> {
  if (await tryLoadUpstash() && _redis) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (_redis as any).del(key);
    } catch {
      // Ignore Redis errors for clear operations
    }
    return;
  }
  clearRateLimit(key);
}

export { getClientIp } from './rateLimit';
