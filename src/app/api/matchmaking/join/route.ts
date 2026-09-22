import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import {
  getActiveUserSession,
  acquireDistributedMatch,
  releaseDistributedSession,
} from '@/lib/matchmakingLock';
import crypto from 'crypto';
import { Prisma } from '@prisma/client';

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Please log in first.' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { skipCurrentMatch = false, excludePartnerId = null } = body;
    const userProfile = user.profile;

    const gender = body.gender || userProfile?.gender || user.gender || 'unspecified';
    const preferredGender = body.preferredGender || userProfile?.preferredGender || 'auto';
    const language = body.language || userProfile?.language || 'english';

    const userCountry = (await import('@/lib/countryDetection')).detectCountryFromHeaders(req.headers);

    // 1. Authoritative check: Does the user already belong to an active match?
    // Enforcing Invariant: ONE USER = ONE ACTIVE CHAT SESSION
    const activeSession = await getActiveUserSession(user.id);

    if (activeSession && !skipCurrentMatch) {
      // User is already in an active session: return it immediately
      const partnerUser = await prisma.user.findUnique({
        where: { id: activeSession.partnerId },
        include: { profile: true },
      });

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
              countryCode: userCountry.countryCode,
              countryName: userCountry.countryName,
              countryFlag: userCountry.countryFlag,
            }
          : null,
      });
    }

    // 2. If user explicitly skipped current match, cleanly release prior active session
    if (activeSession && skipCurrentMatch) {
      const { addRematchExclusion } = await import('@/lib/antiRematch');
      await addRematchExclusion(user.id, activeSession.partnerId, 60000);

      await releaseDistributedSession({
        sessionId: activeSession.chatSessionId,
        userAId: user.id,
        userBId: activeSession.partnerId,
        endedBy: user.id,
      });

      await prisma.chatSession.updateMany({
        where: { id: activeSession.chatSessionId },
        data: { status: 'ENDED', endedAt: new Date() },
      }).catch(() => {});
    }

    // 3. Check if Random Chat is enabled globally
    const chatSetting = await prisma.appSetting.findUnique({
      where: { key: 'randomChatEnabled' },
    });
    const randomChatEnabled = chatSetting ? chatSetting.value !== 'false' : true;
    if (!randomChatEnabled) {
      return NextResponse.json(
        {
          error: 'Random Chat is currently unavailable. Please try again later.',
          disabled: true,
        },
        { status: 503 }
      );
    }

    // 4. Clean up stale WAITING queue entries (>25s inactive)
    const STALE_THRESHOLD = new Date(Date.now() - 25 * 1000);
    await prisma.matchmakingQueue.updateMany({
      where: {
        status: 'WAITING',
        updatedAt: { lt: STALE_THRESHOLD },
      },
      data: { status: 'EXPIRED' },
    }).catch(() => {});

    // 5. Exclude self, blocked users, and 60-Second Anti-Rematch Excluded partners
    const [blockedRelations, antiRematchExcludedIds] = await Promise.all([
      prisma.block.findMany({
        where: { OR: [{ blockerId: user.id }, { blockedId: user.id }] },
      }),
      (await import('@/lib/antiRematch')).getActiveExcludedPartnerIds(user.id),
    ]);
    const blockedUserIds = blockedRelations.map((b) => (b.blockerId === user.id ? b.blockedId : b.blockerId));

    const excludeUserIds = Array.from(
      new Set([
        user.id,
        user.clerkUserId,
        ...blockedUserIds,
        ...antiRematchExcludedIds,
        ...(excludePartnerId ? [excludePartnerId] : []),
      ])
    ).filter(Boolean) as string[];

    // Claim a WAITING row for the current caller before evaluating candidates.
    // This gives both sides a database row that can be conditionally claimed atomically.
    await prisma.matchmakingQueue.upsert({
      where: { userId: user.id },
      update: {
        status: 'WAITING',
        chatSessionId: null,
        partnerUserId: null,
        gender,
        preferredGender,
        language,
        countryCode: userCountry.countryCode,
        countryName: userCountry.countryName,
        countryFlag: userCountry.countryFlag,
        joinedAt: new Date(),
        updatedAt: new Date(),
      },
      create: {
        userId: user.id,
        status: 'WAITING',
        gender,
        preferredGender,
        language,
        countryCode: userCountry.countryCode,
        countryName: userCountry.countryName,
        countryFlag: userCountry.countryFlag,
      },
    });

    // 6. Find all active WAITING candidates currently on the website
    const candidates = await prisma.matchmakingQueue.findMany({
      where: {
        status: 'WAITING',
        userId: { notIn: excludeUserIds },
        updatedAt: { gte: STALE_THRESHOLD },
      },
      take: 20,
    });

    // Randomly shuffle eligible candidates for unpredictable, genuine random matching
    const candidatesToEvaluate = [...candidates].sort(() => Math.random() - 0.5);

    // 7. Atomically match with an eligible candidate enforcing:
    // ONE USER -> ONE ACTIVE CHAT SESSION -> EXACTLY TWO USERS
    for (const candidate of candidatesToEvaluate) {
      // Invariant check: Verify candidate does NOT already have an active session
      const candidateActive = await getActiveUserSession(candidate.userId);
      if (candidateActive) {
        continue;
      }

      const newChatSessionId = crypto.randomUUID();

      // Step 7a: Fast Prisma preflight; the DB transaction below performs the atomic claim.
      const lockResult = await acquireDistributedMatch({
        userAId: user.id,
        userBId: candidate.userId,
        sessionId: newChatSessionId,
        userAData: { countryCode: userCountry.countryCode, countryFlag: userCountry.countryFlag },
        userBData: { countryCode: candidate.countryCode, countryFlag: candidate.countryFlag },
      });

      if (!lockResult.success) {
        // Contention or candidate already claimed: try next candidate
        continue;
      }

      // Step 7b: Atomic Prisma transaction. Both queue rows must still be WAITING.
      try {
        const matchResult = await prisma.$transaction(async (tx) => {
          // Conditionally claim the candidate. If another request claimed them first,
          // count will be 0 and this transaction is rolled back.
          const candidateClaim = await tx.matchmakingQueue.updateMany({
            where: {
              userId: candidate.userId,
              status: 'WAITING',
              updatedAt: { gte: STALE_THRESHOLD },
            },
            data: {
              status: 'MATCHED',
              chatSessionId: newChatSessionId,
              partnerUserId: user.id,
              updatedAt: new Date(),
            },
          });

          if (candidateClaim.count !== 1) {
            return null;
          }

          // Claim the current caller at the same time. This prevents A<->B
          // double-matching when both users click Join concurrently.
          const callerClaim = await tx.matchmakingQueue.updateMany({
            where: {
              userId: user.id,
              status: 'WAITING',
            },
            data: {
              status: 'MATCHED',
              chatSessionId: newChatSessionId,
              partnerUserId: candidate.userId,
              gender,
              preferredGender,
              language,
              countryCode: userCountry.countryCode,
              countryName: userCountry.countryName,
              countryFlag: userCountry.countryFlag,
              updatedAt: new Date(),
            },
          });

          if (callerClaim.count !== 1) {
            throw new Error('caller_queue_claim_lost');
          }

          // Create authoritative active ChatSession
          return await tx.chatSession.create({
            data: {
              id: newChatSessionId,
              userAId: user.id,
              userBId: candidate.userId,
              status: 'ACTIVE',
            },
          });
        }, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 5000,
          timeout: 10000,
        });

        if (matchResult) {
          const partnerUser = await prisma.user.findUnique({
            where: { id: candidate.userId },
            include: { profile: true },
          });

          console.log('[RANDOM_CHAT][MATCH]', {
            state: 'matched',
            matchId: newChatSessionId,
            user1Id: user.id,
            user2Id: candidate.userId,
            partnerCountry: `${candidate.countryFlag || '🌐'} ${candidate.countryName || 'Global'}`,
            timestamp: new Date().toISOString(),
          });

          return NextResponse.json({
            matched: true,
            chatSessionId: newChatSessionId,
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
                  countryCode: candidate.countryCode || 'IN',
                  countryName: candidate.countryName || 'India',
                  countryFlag: candidate.countryFlag || '🇮🇳',
                }
              : null,
          });
        } else {
          // Prisma transaction aborted: rollback distributed lock
          await releaseDistributedSession({
            sessionId: newChatSessionId,
            userAId: user.id,
            userBId: candidate.userId,
          });
        }
      } catch (err) {
        console.warn('Matchmaking contention, checking next candidate:', err);
        await releaseDistributedSession({
          sessionId: newChatSessionId,
          userAId: user.id,
          userBId: candidate.userId,
        });
      }
    }

    // 8. No immediate candidate matched: Put user into WAITING queue
    await prisma.matchmakingQueue.upsert({
      where: { userId: user.id },
      update: {
        status: 'WAITING',
        chatSessionId: null,
        partnerUserId: null,
        gender,
        preferredGender,
        language,
        countryCode: userCountry.countryCode,
        countryName: userCountry.countryName,
        countryFlag: userCountry.countryFlag,
        joinedAt: new Date(),
        updatedAt: new Date(),
      },
      create: {
        userId: user.id,
        status: 'WAITING',
        gender,
        preferredGender,
        language,
        countryCode: userCountry.countryCode,
        countryName: userCountry.countryName,
        countryFlag: userCountry.countryFlag,
        joinedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      matched: false,
      status: 'WAITING',
      message: 'Looking for a person to chat with you...',
    });
  } catch (error: any) {
    console.error('[RANDOM_CHAT][ERROR]', {
      state: 'join_queue_error',
      error: error?.message || String(error),
      timestamp: new Date().toISOString(),
    });
    return NextResponse.json({ error: 'Failed to join matchmaking queue' }, { status: 500 });
  }
}
