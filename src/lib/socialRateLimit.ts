// Sliding window in-memory rate limiter per key (userId / IP)
const rateLimitStore = new Map<string, number[]>();

// Cleanup stale keys every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of rateLimitStore.entries()) {
    const fresh = timestamps.filter((t) => now - t < 60000);
    if (fresh.length === 0) {
      rateLimitStore.delete(key);
    } else {
      rateLimitStore.set(key, fresh);
    }
  }
}, 10 * 60 * 1000);

export function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const timestamps = (rateLimitStore.get(key) || []).filter((t) => now - t < windowMs);

  if (timestamps.length >= maxRequests) {
    return false; // Exceeded limit
  }

  timestamps.push(now);
  rateLimitStore.set(key, timestamps);
  return true;
}
