// In-Memory Match Queue singleton with Smart Priority Matching for VIPs
export interface QueueCandidate {
  userId: string;
  socketId?: string;
  username: string;
  fullName: string;
  displayName: string;
  avatarEmoji?: string;
  avatarUrl?: string | null;
  gender: string;
  plan: 'free' | 'vip';
  isVIP: boolean;
  genderPref: string; // 'any' | 'male' | 'female' | 'non-binary' | 'auto'
  mood?: string; // 'romantic' | 'flirty' | 'friendly' | 'chill' | 'deep' | 'funny'
  tags: string[]; // e.g. ['music', 'anime', 'coding', 'travel', 'fitness']
  language: string;
  joinedAt: number;
  blockedUserIds: string[];
}

// Mood Compatibility Map
const MOOD_COMPATIBILITY: Record<string, string[]> = {
  romantic: ['romantic', 'flirty', 'deep'],
  flirty: ['flirty', 'romantic', 'funny'],
  friendly: ['friendly', 'chill', 'funny'],
  chill: ['chill', 'friendly', 'deep', 'music'],
  deep: ['deep', 'romantic', 'chill'],
  funny: ['funny', 'friendly', 'flirty'],
};

export function areMoodsCompatible(moodA?: string, moodB?: string): boolean {
  if (!moodA || !moodB) return true;
  const mA = moodA.toLowerCase();
  const mB = moodB.toLowerCase();
  if (mA === mB) return true;
  const compatibleWithA = MOOD_COMPATIBILITY[mA];
  return Boolean(compatibleWithA && compatibleWithA.includes(mB));
}

export function calculateMatchScore(userA: QueueCandidate, userB: QueueCandidate, now: number): { canMatch: boolean; score: number } {
  // 1. Never match with self
  if (userA.userId === userB.userId) {
    return { canMatch: false, score: -1 };
  }

  // 2. Abuse prevention: Block check (Never re-suggest blocked pairings)
  if (
    userA.blockedUserIds.includes(userB.userId) ||
    userB.blockedUserIds.includes(userA.userId)
  ) {
    return { canMatch: false, score: -1 };
  }

  let score = 0;
  const waitTimeA = now - userA.joinedAt;
  const isVipA = userA.isVIP || userA.plan === 'vip';
  const isVipB = userB.isVIP || userB.plan === 'vip';

  // 3. Gender Preference Scoring & Strict/Fallback Logic
  // User A preference check
  if (isVipA && userA.genderPref && userA.genderPref !== 'any' && userA.genderPref !== 'auto') {
    const isGenderMatch = userA.genderPref.toLowerCase() === userB.gender.toLowerCase();
    if (isGenderMatch) {
      score += 3;
    } else if (waitTimeA < 8000) {
      // Within 8 seconds, VIP strictly waits for target gender
      return { canMatch: false, score: -1 };
    }
    // After 8s fallback: allow match without +3 score boost
  }

  // User B preference check
  const waitTimeB = now - userB.joinedAt;
  if (isVipB && userB.genderPref && userB.genderPref !== 'any' && userB.genderPref !== 'auto') {
    const isGenderMatch = userB.genderPref.toLowerCase() === userA.gender.toLowerCase();
    if (isGenderMatch) {
      score += 3;
    } else if (waitTimeB < 8000) {
      return { canMatch: false, score: -1 };
    }
  }

  // 4. Shared Personality Tags (+2 per shared tag)
  const tagsA = userA.tags || [];
  const tagsB = userB.tags || [];
  const sharedTags = tagsA.filter((t) => tagsB.includes(t));
  score += sharedTags.length * 2;

  // 5. Mood Compatibility (+1 if compatible)
  if (areMoodsCompatible(userA.mood, userB.mood)) {
    score += 1;
  }

  // 6. VIP Priority & Wait Time Bonus
  if (isVipA || isVipB) {
    score += 1; // Prioritize VIP pairs in queue
  }

  // Tie-breaker: Longer waiting partner adds fractional bonus
  const longestWaitSeconds = Math.max(waitTimeA, waitTimeB) / 1000;
  score += longestWaitSeconds * 0.01;

  return { canMatch: true, score };
}

class InMemoryMatchQueue {
  private queue: Map<string, QueueCandidate> = new Map();

  public addCandidate(candidate: QueueCandidate) {
    this.queue.set(candidate.userId, {
      ...candidate,
      joinedAt: candidate.joinedAt || Date.now(),
      tags: candidate.tags || [],
      blockedUserIds: candidate.blockedUserIds || [],
    });
  }

  public removeCandidate(userId: string) {
    this.queue.delete(userId);
  }

  public getCandidate(userId: string): QueueCandidate | undefined {
    return this.queue.get(userId);
  }

  /**
   * Smart Priority Matching:
   * 1. Free users: random pairing among available users.
   * 2. VIP users: weighted priority matching (+3 genderPref, +2 tags, +1 mood).
   * Fallback to random pairing after 8s.
   */
  public findMatch(user: QueueCandidate): QueueCandidate | null {
    const now = Date.now();
    let bestCandidate: QueueCandidate | null = null;
    let highestScore = -1;

    for (const [candidateId, candidate] of this.queue.entries()) {
      if (candidateId === user.userId) continue;

      const { canMatch, score } = calculateMatchScore(user, candidate, now);

      if (canMatch) {
        // For free users, first compatible user is matched (or score > highestScore)
        if (score > highestScore) {
          highestScore = score;
          bestCandidate = candidate;
        }
      }
    }

    if (bestCandidate) {
      // Remove both from queue upon match
      this.queue.delete(bestCandidate.userId);
      this.queue.delete(user.userId);
      return bestCandidate;
    }

    return null;
  }

  public size(): number {
    return this.queue.size;
  }

  public clearStale(maxAgeMs: number = 60000) {
    const now = Date.now();
    for (const [userId, candidate] of this.queue.entries()) {
      if (now - candidate.joinedAt > maxAgeMs) {
        this.queue.delete(userId);
      }
    }
  }
}

// Global singleton instance across Next.js reloads
const globalForQueue = globalThis as unknown as {
  inMemoryQueue: InMemoryMatchQueue | undefined;
};

export const inMemoryQueue = globalForQueue.inMemoryQueue ?? new InMemoryMatchQueue();

if (process.env.NODE_ENV !== 'production') {
  globalForQueue.inMemoryQueue = inMemoryQueue;
}
