import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { DELETION_LOCK_TTL_MS } from '@/lib/config/policy';

/**
 * Server-side secret for hashing emails into anonymous anti-abuse deletion locks.
 * Never exposed to client. Salted HMAC prevents offline rainbow table attacks.
 */
function getDeletionSecret(): string {
  return (
    process.env.DELETION_LOCK_SECRET ||
    process.env.CLERK_SECRET_KEY ||
    process.env.JWT_SECRET ||
    'cupidx-production-deletion-lock-salt-2026'
  );
}

/**
 * Normalizes email according to consistent application identity rules:
 * - Trims whitespace
 * - Converts to lowercase
 * Note: Does not strip dots or plus-tags to preserve literal authenticated provider identity.
 */
export function normalizeEmail(email: string): string {
  if (!email || typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

/**
 * Computes a secure, salted HMAC-SHA256 hash of the normalized email address.
 * The raw email address is NEVER stored in the tombstone table.
 */
export function computeEmailHash(normalizedEmail: string): string {
  const secret = getDeletionSecret();
  return crypto.createHmac('sha256', secret).update(normalizedEmail).digest('hex');
}

/**
 * Creates or refreshes a 48-hour deletion lock for a verified email address.
 * Idempotent: If an active lock already exists for this email hash, updates expiresAt.
 */
export async function createDeletionLock(email: string): Promise<{ success: boolean; expiresAt: Date }> {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return { success: false, expiresAt: new Date() };
  }

  const emailHash = computeEmailHash(normalized);
  const expiresAt = new Date(Date.now() + DELETION_LOCK_TTL_MS);

  await prisma.deletedAccountLock.upsert({
    where: { emailHash },
    update: {
      expiresAt,
      reason: 'ACCOUNT_DELETION_COOLDOWN',
    },
    create: {
      emailHash,
      expiresAt,
      reason: 'ACCOUNT_DELETION_COOLDOWN',
    },
  });

  return { success: true, expiresAt };
}

/**
 * Authoritatively checks if a verified email identity is currently under the 48-hour deletion cooldown.
 * Expired locks (expiresAt <= now) are considered inactive and automatically pruned.
 */
export async function checkDeletionLock(
  email: string
): Promise<{ isLocked: boolean; expiresAt?: Date; remainingHours?: number }> {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return { isLocked: false };
  }

  const emailHash = computeEmailHash(normalized);
  const now = new Date();

  const lock = await prisma.deletedAccountLock.findFirst({
    where: {
      emailHash,
      expiresAt: { gt: now },
    },
  });

  if (!lock) {
    return { isLocked: false };
  }

  const remainingMs = lock.expiresAt.getTime() - now.getTime();
  const remainingHours = Math.max(1, Math.ceil(remainingMs / (1000 * 60 * 60)));

  return {
    isLocked: true,
    expiresAt: lock.expiresAt,
    remainingHours,
  };
}

/**
 * Background/lazy garbage collection for expired deletion locks.
 */
export async function pruneExpiredDeletionLocks(): Promise<number> {
  try {
    const result = await prisma.deletedAccountLock.deleteMany({
      where: {
        expiresAt: { lte: new Date() },
      },
    });
    return result.count;
  } catch (err) {
    console.warn('Notice pruning expired deletion locks:', err);
    return 0;
  }
}
