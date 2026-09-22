import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { getActiveUserSession } from '@/lib/matchmakingLock';

async function resolveCanonicalUserId(identifier: string, displayName = 'Stranger'): Promise<string> {
  if (!identifier) return identifier;
  try {
    const existing = await prisma.user.findFirst({
      where: { OR: [{ id: identifier }, { clerkUserId: identifier }] },
      select: { id: true },
    });
    if (existing) {
      return existing.id;
    }
    const suffix = Math.random().toString(36).slice(2, 6);
    const created = await prisma.user.create({
      data: {
        id: identifier,
        clerkUserId: identifier,
        username: `user_${identifier.slice(-6)}_${suffix}`,
        fullName: displayName,
        displayName: displayName,
        gender: 'unspecified',
        profile: {
          create: {
            gender: 'unspecified',
            avatarEmoji: '😊',
          },
        },
      },
      select: { id: true },
    });
    return created.id;
  } catch (e) {
    const fallback = await prisma.user.findFirst({
      where: { OR: [{ id: identifier }, { clerkUserId: identifier }] },
      select: { id: true },
    });
    return fallback ? fallback.id : identifier;
  }
}

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Authoritatively check the Prisma/Supabase active session
    const activeSession = await getActiveUserSession(user.id);
    if (activeSession && activeSession.active) {
      // User is authoritatively matched in an active session!
      // Synchronize local Prisma chat session if cross-container cache missed
      let session = await prisma.chatSession.findUnique({
        where: { id: activeSession.chatSessionId },
      });

      if (!session) {
        const [canonicalA, canonicalB] = await Promise.all([
          resolveCanonicalUserId(user.id, user.displayName || user.fullName || 'Stranger'),
          resolveCanonicalUserId(activeSession.partnerId, 'Stranger'),
        ]);

        session = await prisma.chatSession.upsert({
          where: { id: activeSession.chatSessionId },
          update: { status: 'ACTIVE' },
          create: {
            id: activeSession.chatSessionId,
            userAId: canonicalA,
            userBId: canonicalB,
            status: 'ACTIVE',
          },
        }).catch(() => null);
      }

      if (session && session.status === 'ACTIVE') {
        const [partnerUser, partnerQueue] = await Promise.all([
          prisma.user.findUnique({
            where: { id: activeSession.partnerId },
            include: { profile: true },
          }),
          prisma.matchmakingQueue.findUnique({
            where: { userId: activeSession.partnerId },
            select: { countryCode: true, countryName: true, countryFlag: true },
          }),
        ]);

        return NextResponse.json({
          matched: true,
          chatSessionId: activeSession.chatSessionId,
          partner: partnerUser
            ? {
                id: partnerUser.id,
                displayName: partnerUser.displayName || partnerUser.fullName || 'Stranger',
                avatarUrl: partnerUser.profile?.avatarUrl || null,
                avatarEmoji: partnerUser.profile?.avatarEmoji || '😊',
                gender: partnerUser.profile?.gender || partnerUser.gender || 'unspecified',
                mood: partnerUser.profile?.mood || '',
                bio: partnerUser.profile?.bio || '',
                isVIP: partnerUser.membershipTier === 'VIP' || partnerUser.is_vip,
                countryCode: partnerQueue?.countryCode || 'IN',
                countryName: partnerQueue?.countryName || 'India',
                countryFlag: partnerQueue?.countryFlag || '🇮🇳',
              }
            : null,
        });
      }
    }

    // 2. Check user's MatchmakingQueue entry
    let userQueue = await prisma.matchmakingQueue.findUnique({
      where: { userId: user.id },
    });

    if (!userQueue) {
      return NextResponse.json({ matched: false, status: 'IDLE' });
    }

    // 3. If local queue says MATCHED: resolve partner details
    if (userQueue.status === 'MATCHED' && userQueue.chatSessionId) {
      const session = await prisma.chatSession.findUnique({
        where: { id: userQueue.chatSessionId },
      });

      if (session && session.status === 'ACTIVE') {
        const partnerId = user.id === session.userAId ? session.userBId : session.userAId;

        const [partnerUser, partnerQueue] = await Promise.all([
          prisma.user.findUnique({
            where: { id: partnerId },
            include: { profile: true },
          }),
          prisma.matchmakingQueue.findUnique({
            where: { userId: partnerId },
            select: { countryCode: true, countryName: true, countryFlag: true },
          }),
        ]);

        return NextResponse.json({
          matched: true,
          chatSessionId: userQueue.chatSessionId,
          partner: partnerUser
            ? {
                id: partnerUser.id,
                displayName: partnerUser.displayName || partnerUser.fullName || 'Stranger',
                avatarUrl: partnerUser.profile?.avatarUrl || null,
                avatarEmoji: partnerUser.profile?.avatarEmoji || '😊',
                gender: partnerUser.profile?.gender || partnerUser.gender || 'unspecified',
                mood: partnerUser.profile?.mood || '',
                bio: partnerUser.profile?.bio || '',
                isVIP: partnerUser.membershipTier === 'VIP' || partnerUser.is_vip,
                countryCode: partnerQueue?.countryCode || 'IN',
                countryName: partnerQueue?.countryName || 'India',
                countryFlag: partnerQueue?.countryFlag || '🇮🇳',
              }
            : null,
        });
      } else if (session && session.status === 'ENDED') {
        return NextResponse.json({ matched: false, status: 'ENDED' });
      }
    }

    // 4. If user is WAITING in queue: heartbeat & keep searching state fresh
    if (userQueue.status === 'WAITING') {
      const now = new Date();
      await prisma.matchmakingQueue.update({
        where: { userId: user.id },
        data: { updatedAt: now },
      }).catch(() => {});

      return NextResponse.json({ matched: false, status: 'WAITING' });
    }

    return NextResponse.json({ matched: false, status: userQueue.status });
  } catch (error: any) {
    console.error('[RANDOM_CHAT][ERROR]', {
      state: 'status_check_error',
      error: error?.message || String(error),
      timestamp: new Date().toISOString(),
    });
    return NextResponse.json({ error: 'Failed to fetch matchmaking status' }, { status: 500 });
  }
}
