import { prisma } from './prisma';

export interface ActiveSessionInfo {
  active: boolean;
  chatSessionId: string;
  partnerId: string;
  createdAt: number;
  source: 'prisma';
}

const STALE_SESSION_MS = 10 * 60 * 1000;

/**
 * Prisma is the single source of truth for matchmaking.
 * It provides robust distributed session management and works with
 * the Supabase Postgres database used by Vercel.
 */
export async function getActiveUserSession(userId: string): Promise<ActiveSessionInfo | null> {
  if (!userId) return null;

  const now = Date.now();

  try {
    const session = await prisma.chatSession.findFirst({
      where: {
        status: 'ACTIVE',
        OR: [{ userAId: userId }, { userBId: userId }],
      },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!session) return null;

    const lastActivity = session.messages[0]?.createdAt || session.startedAt;
    const isFresh = now - new Date(lastActivity).getTime() < STALE_SESSION_MS;
    const partnerId = session.userAId === userId ? session.userBId : session.userAId;

    if (isFresh) {
      return {
        active: true,
        chatSessionId: session.id,
        partnerId,
        createdAt: new Date(session.startedAt).getTime(),
        source: 'prisma',
      };
    }

    await prisma.chatSession.update({
      where: { id: session.id },
      data: { status: 'ENDED', endedAt: new Date() },
    }).catch(() => {});

    await prisma.matchmakingQueue.updateMany({
      where: {
        userId: { in: [userId, partnerId] },
        chatSessionId: session.id,
      },
      data: {
        status: 'EXPIRED',
        chatSessionId: null,
        partnerUserId: null,
        updatedAt: new Date(),
      },
    }).catch(() => {});

    return null;
  } catch (err) {
    console.warn('[MATCHMAKING_LOCK] getActiveUserSession error:', err);
    return null;
  }
}

/**
 * Fast preflight check. The actual claim is performed atomically by the
 * Prisma transaction in /api/matchmaking/join.
 */
export async function acquireDistributedMatch(params: {
  userAId: string;
  userBId: string;
  sessionId: string;
  userAData?: Record<string, any>;
  userBData?: Record<string, any>;
}): Promise<{ success: boolean; reason?: string }> {
  const { userAId, userBId } = params;
  if (!userAId || !userBId || userAId === userBId) {
    return { success: false, reason: 'invalid_user_ids' };
  }

  try {
    const [a, b] = await Promise.all([
      getActiveUserSession(userAId),
      getActiveUserSession(userBId),
    ]);

    if (a) return { success: false, reason: 'userA_already_has_active_session' };
    if (b) return { success: false, reason: 'userB_already_has_active_session' };

    return { success: true };
  } catch (err) {
    console.warn('[MATCHMAKING_LOCK] preflight error:', err);
    return { success: false, reason: 'lock_check_failed' };
  }
}

/**
 * Ends the authoritative Prisma chat session and releases both queue rows.
 */
export async function releaseDistributedSession(params: {
  sessionId?: string | null;
  userAId?: string | null;
  userBId?: string | null;
  endedBy?: string | null;
}): Promise<void> {
  const { sessionId, userAId, userBId } = params;
  const userIds = [userAId, userBId].filter(Boolean) as string[];

  try {
    if (sessionId) {
      await prisma.chatSession.updateMany({
        where: { id: sessionId, status: 'ACTIVE' },
        data: { status: 'ENDED', endedAt: new Date() },
      });
    }

    if (userIds.length) {
      await prisma.matchmakingQueue.updateMany({
        where: {
          userId: { in: userIds },
          ...(sessionId ? { chatSessionId: sessionId } : {}),
        },
        data: {
          status: 'CANCELLED',
          chatSessionId: null,
          partnerUserId: null,
          updatedAt: new Date(),
        },
      });
    }
  } catch (err) {
    console.warn('[MATCHMAKING_LOCK] releaseDistributedSession error:', err);
  }
}

export async function setUserSearching(
  userId: string,
  preferences: Record<string, any> = {}
): Promise<void> {
  if (!userId) return;

  try {
    await prisma.matchmakingQueue.upsert({
      where: { userId },
      update: {
        status: 'WAITING',
        chatSessionId: null,
        partnerUserId: null,
        ...(preferences as any),
        updatedAt: new Date(),
      },
      create: {
        userId,
        status: 'WAITING',
        ...(preferences as any),
      },
    });
  } catch (err) {
    console.warn('[MATCHMAKING_LOCK] setUserSearching error:', err);
  }
}

export async function removeUserSearching(userId: string): Promise<void> {
  if (!userId) return;

  try {
    await prisma.matchmakingQueue.updateMany({
      where: { userId },
      data: {
        status: 'CANCELLED',
        chatSessionId: null,
        partnerUserId: null,
        updatedAt: new Date(),
      },
    });
  } catch (err) {
    console.warn('[MATCHMAKING_LOCK] removeUserSearching error:', err);
  }
}
