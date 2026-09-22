// In-memory rate limiting tracker (Account + IP dual keying to protect against brute-force and credential stuffing)
import { NextResponse } from 'next/server';

export interface RateLimitResult {
  isBlocked: boolean;
  retryAfterSeconds: number;
  limit: number;
  remaining: number;
  resetTime: number;
}

interface RateLimitRecord {
  attempts: number;
  firstAttemptTime: number;
  blockedUntil: number;
}

const rateLimitMap = new Map<string, RateLimitRecord>();

// Periodic garbage collection to prevent memory leaks in long-running instances
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitMap.entries()) {
      if (now > record.blockedUntil && now - record.firstAttemptTime > 60 * 60 * 1000) {
        rateLimitMap.delete(key);
      }
    }
  }, 10 * 60 * 1000).unref?.();
}

export function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }
  return '127.0.0.1';
}

/**
 * Sliding window rate limit checker
 */
export function checkRateLimit(
  key: string,
  maxAttempts: number = 5,
  windowMs: number = 15 * 60 * 1000
): RateLimitResult {
  const now = Date.now();
  const record = rateLimitMap.get(key);

  if (!record) {
    return {
      isBlocked: false,
      retryAfterSeconds: 0,
      limit: maxAttempts,
      remaining: maxAttempts,
      resetTime: now + windowMs,
    };
  }

  // If window expired and not blocked
  if (now > record.blockedUntil && now - record.firstAttemptTime > windowMs) {
    rateLimitMap.delete(key);
    return {
      isBlocked: false,
      retryAfterSeconds: 0,
      limit: maxAttempts,
      remaining: maxAttempts,
      resetTime: now + windowMs,
    };
  }

  // Active block
  if (now < record.blockedUntil) {
    const retryAfterSeconds = Math.ceil((record.blockedUntil - now) / 1000);
    return {
      isBlocked: true,
      retryAfterSeconds,
      limit: maxAttempts,
      remaining: 0,
      resetTime: record.blockedUntil,
    };
  }

  // Check attempt count
  if (record.attempts >= maxAttempts) {
    record.blockedUntil = now + windowMs;
    const retryAfterSeconds = Math.ceil(windowMs / 1000);
    return {
      isBlocked: true,
      retryAfterSeconds,
      limit: maxAttempts,
      remaining: 0,
      resetTime: record.blockedUntil,
    };
  }

  return {
    isBlocked: false,
    retryAfterSeconds: 0,
    limit: maxAttempts,
    remaining: Math.max(0, maxAttempts - record.attempts),
    resetTime: record.firstAttemptTime + windowMs,
  };
}

export function recordFailedAttempt(
  key: string,
  windowMs: number = 15 * 60 * 1000,
  blockThreshold: number = 5
) {
  const now = Date.now();
  const record = rateLimitMap.get(key) || {
    attempts: 0,
    firstAttemptTime: now,
    blockedUntil: 0,
  };

  if (now - record.firstAttemptTime > windowMs && now > record.blockedUntil) {
    record.attempts = 1;
    record.firstAttemptTime = now;
    record.blockedUntil = 0;
  } else {
    record.attempts += 1;
  }

  if (record.attempts >= blockThreshold) {
    record.blockedUntil = now + windowMs;
  }

  rateLimitMap.set(key, record);
}

export function clearRateLimit(key: string) {
  rateLimitMap.delete(key);
}

/**
 * High-security multi-tier rate limiter for auth routes (BUG-003):
 * 1. IP-level rapid request limit (default 10 requests / 60 seconds)
 * 2. Account-level brute-force limit (default 5 failed attempts / 15 minutes)
 */
export function checkAuthRateLimit(
  clientIp: string,
  identifier?: string,
  options: {
    ipMax?: number;
    ipWindowMs?: number;
    accountMax?: number;
    accountWindowMs?: number;
  } = {}
): RateLimitResult {
  const ipMax = options.ipMax ?? 10;
  const ipWindowMs = options.ipWindowMs ?? 60 * 1000;
  const accountMax = options.accountMax ?? 5;
  const accountWindowMs = options.accountWindowMs ?? 15 * 60 * 1000;

  // 1. Verify IP-level throttling first
  const ipKey = `auth:ip:${clientIp}`;
  const ipCheck = checkRateLimit(ipKey, ipMax, ipWindowMs);
  if (ipCheck.isBlocked) {
    return ipCheck;
  }

  // 2. Verify account/identifier level throttling if identifier provided
  if (identifier) {
    const cleanId = identifier.toLowerCase().trim();
    const accountKey = `auth:account:${cleanId}:${clientIp}`;
    const accountCheck = checkRateLimit(accountKey, accountMax, accountWindowMs);
    if (accountCheck.isBlocked) {
      return accountCheck;
    }
  }

  return ipCheck;
}

export function recordAuthAttempt(
  clientIp: string,
  identifier?: string,
  isFailed: boolean = true
) {
  // Always count request towards IP throttle
  const ipKey = `auth:ip:${clientIp}`;
  recordFailedAttempt(ipKey, 60 * 1000, 10);

  // If failed attempt, record to account throttle
  if (identifier && isFailed) {
    const cleanId = identifier.toLowerCase().trim();
    const accountKey = `auth:account:${cleanId}:${clientIp}`;
    recordFailedAttempt(accountKey, 15 * 60 * 1000, 5);
  } else if (identifier && !isFailed) {
    // Clear account failures upon success
    const cleanId = identifier.toLowerCase().trim();
    clearRateLimit(`auth:account:${cleanId}:${clientIp}`);
  }
}

/**
 * Attaches standard rate-limiting headers to HTTP response
 */
export function applyRateLimitHeaders(
  response: NextResponse,
  limitCheck: RateLimitResult
): NextResponse {
  response.headers.set('X-RateLimit-Limit', limitCheck.limit.toString());
  response.headers.set('X-RateLimit-Remaining', Math.max(0, limitCheck.remaining).toString());
  response.headers.set('X-RateLimit-Reset', Math.ceil(limitCheck.resetTime / 1000).toString());

  if (limitCheck.isBlocked && limitCheck.retryAfterSeconds > 0) {
    response.headers.set('Retry-After', limitCheck.retryAfterSeconds.toString());
  }

  return response;
}
