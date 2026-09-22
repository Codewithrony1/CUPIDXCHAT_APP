export const RESERVED_USERNAMES = new Set([
  'admin',
  'administrator',
  'support',
  'official',
  'moderator',
  'mod',
  'system',
  'cupid',
  'cupidx',
  'cupidxchat',
  'staff',
  'help',
  'root',
  'security',
  'billing',
  'payments',
  'verified',
  'anonymous',
  'stranger',
  'superuser',
  'developer',
  'api',
  'bot',
  'guest',
  'team',
  'safety',
]);

export const DEFAULT_BIO = "Hey there! I am using CupidX.";

export function isUserVip(user: any): boolean {
  if (!user) return false;
  const now = new Date();

  // 1. Explicit vip_expires_at on User
  if (user.vip_expires_at && new Date(user.vip_expires_at).getTime() <= now.getTime()) {
    return false;
  }

  // 2. Subscription period check
  if (user.subscription) {
    const sub = user.subscription;
    const subEnd = sub.endDate || sub.currentPeriodEnd;
    if (subEnd && new Date(subEnd).getTime() <= now.getTime()) {
      return false;
    }
    if (sub.isActive === true && sub.plan === 'VIP') {
      return true;
    }
  }

  // 3. User VIP flags
  if (user.is_vip || user.membershipTier === 'VIP' || user.isVIP) {
    if (!user.vip_expires_at || new Date(user.vip_expires_at).getTime() > now.getTime()) {
      return true;
    }
  }

  return false;
}

export function validateUsernameFormat(raw: string): { valid: boolean; clean: string; reason?: string } {
  if (!raw || typeof raw !== 'string') {
    return { valid: false, clean: '', reason: 'Username is required.' };
  }
  const clean = raw.toLowerCase().trim().replace(/^@/, '');
  if (clean.length < 3) {
    return { valid: false, clean, reason: 'Username must be at least 3 characters.' };
  }
  if (clean.length > 20) {
    return { valid: false, clean, reason: 'Username cannot exceed 20 characters.' };
  }
  if (!/^[a-z0-9_]+$/.test(clean)) {
    return { valid: false, clean, reason: 'Only lowercase letters, numbers, and underscores are permitted.' };
  }
  if (RESERVED_USERNAMES.has(clean)) {
    return { valid: false, clean, reason: 'This username is reserved and cannot be claimed.' };
  }
  return { valid: true, clean };
}

export function getCanonicalPair(idA: string, idB: string): [string, string] {
  return idA < idB ? [idA, idB] : [idB, idA];
}
