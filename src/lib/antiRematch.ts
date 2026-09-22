import { prisma } from './prisma';

// In-memory pair TTL cache for sub-millisecond lookups within a process:
// pairHash -> expiresAt timestamp (ms)
const inMemoryRematchExclusions = new Map<string, number>();

/**
 * Generate a deterministic canonical pair hash for two user IDs.
 * Always sorted alphabetically so pair(A, B) === pair(B, A).
 */
export function getRematchPairHash(userAId: string, userBId: string): string {
  if (!userAId || !userBId) return '';
  const [first, second] = [userAId, userBId].sort();
  return `rematch:${first}::${second}`;
}

/**
 * Add two users to the temporary rematch exclusion list (default 60 seconds).
 * Updates in-memory map immediately and persists to database for multi-instance sync.
 */
export async function addRematchExclusion(
  userAId: string,
  userBId: string,
  durationMs = 60000
): Promise<void> {
  if (!userAId || !userBId || userAId === userBId) return;

  const pairHash = getRematchPairHash(userAId, userBId);
  const now = Date.now();
  const expiresAtMs = now + durationMs;
  const expiresAtDate = new Date(expiresAtMs);

  // 1. Instant in-memory cache update
  inMemoryRematchExclusions.set(pairHash, expiresAtMs);

  // 2. Persist to shared database for cross-instance / serverless consistency
  try {
    const [first, second] = [userAId, userBId].sort();
    await prisma.antiRematchExclusion.upsert({
      where: { pairHash },
      update: {
        expiresAt: expiresAtDate,
      },
      create: {
        pairHash,
        user1Id: first,
        user2Id: second,
        expiresAt: expiresAtDate,
      },
    });
  } catch (err) {
    console.warn('[AntiRematch] Failed to persist exclusion to DB:', err);
  }
}

/**
 * Check if two users are currently barred from matching under the 60-second anti-rematch rule.
 */
export async function isRematchExcluded(
  userAId: string,
  userBId: string
): Promise<boolean> {
  if (!userAId || !userBId || userAId === userBId) return true;

  const pairHash = getRematchPairHash(userAId, userBId);
  const now = Date.now();

  // 1. Check in-memory cache first
  const memoryExpiresAt = inMemoryRematchExclusions.get(pairHash);
  if (memoryExpiresAt) {
    if (memoryExpiresAt > now) {
      return true;
    }
    inMemoryRematchExclusions.delete(pairHash);
  }

  // 2. Check database
  try {
    const record = await prisma.antiRematchExclusion.findUnique({
      where: { pairHash },
      select: { expiresAt: true },
    });

    if (record && record.expiresAt.getTime() > now) {
      inMemoryRematchExclusions.set(pairHash, record.expiresAt.getTime());
      return true;
    }
  } catch (err) {
    console.warn('[AntiRematch] Error querying exclusion record:', err);
  }

  return false;
}

/**
 * Retrieve all currently excluded partner user IDs for a given user.
 * Used to filter matchmaking candidate queries directly in SQL/Prisma.
 */
export async function getActiveExcludedPartnerIds(userId: string): Promise<string[]> {
  if (!userId) return [];

  const now = new Date();
  const excludedIds: Set<string> = new Set();

  // In-memory scan for active keys involving this user
  const nowMs = now.getTime();
  inMemoryRematchExclusions.forEach((exp, hash) => {
    if (exp > nowMs && hash.includes(userId)) {
      const parts = hash.replace('rematch:', '').split('::');
      parts.forEach((id) => {
        if (id && id !== userId) excludedIds.add(id);
      });
    }
  });

  // Query database for all active exclusions
  try {
    const records = await prisma.antiRematchExclusion.findMany({
      where: {
        OR: [{ user1Id: userId }, { user2Id: userId }],
        expiresAt: { gt: now },
      },
      select: { user1Id: true, user2Id: true },
    });

    records.forEach((r) => {
      if (r.user1Id === userId && r.user2Id) excludedIds.add(r.user2Id);
      if (r.user2Id === userId && r.user1Id) excludedIds.add(r.user1Id);
    });
  } catch (err) {
    console.warn('[AntiRematch] Failed to fetch active exclusions from DB:', err);
  }

  return Array.from(excludedIds);
}

/**
 * Clean up expired exclusion records from database and memory.
 */
export async function cleanupExpiredRematchExclusions(): Promise<number> {
  const nowMs = Date.now();
  inMemoryRematchExclusions.forEach((exp, hash) => {
    if (exp <= nowMs) {
      inMemoryRematchExclusions.delete(hash);
    }
  });

  try {
    const result = await prisma.antiRematchExclusion.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });
    return result.count;
  } catch {
    return 0;
  }
}
