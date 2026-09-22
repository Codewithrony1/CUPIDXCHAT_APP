import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { getActiveUserSession, removeUserSearching } from '@/lib/matchmakingLock';

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check race condition: did a match succeed right before cancellation arrived?
    const activeSession = await getActiveUserSession(user.id);
    if (activeSession && activeSession.active) {
      // Match won the race condition: inform client so both stay connected
      return NextResponse.json({
        success: false,
        matched: true,
        chatSessionId: activeSession.chatSessionId,
        message: 'Match already established.',
      });
    }

    // Cancel wins: remove from queue and mark CANCELLED
    await prisma.matchmakingQueue.updateMany({
      where: { userId: user.id },
      data: {
        status: 'CANCELLED',
        updatedAt: new Date(),
      },
    }).catch(() => {});

    // Release Prisma/Supabase matchmaking queue state
    await removeUserSearching(user.id);

    return NextResponse.json({
      success: true,
      cancelled: true,
      message: 'Matchmaking successfully cancelled.',
    });
  } catch (error: any) {
    console.error('Matchmaking Cancel Error:', error);
    return NextResponse.json({ error: 'Failed to cancel matchmaking' }, { status: 500 });
  }
}
