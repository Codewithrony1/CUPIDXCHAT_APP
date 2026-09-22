import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { targetUsername } = await req.json();
    if (!targetUsername) {
      return NextResponse.json({ error: 'Target username is required' }, { status: 400 });
    }

    const cleanTargetUsername = targetUsername.toLowerCase().trim().replace(/^@/, '');

    const targetUser = await prisma.user.findUnique({
      where: { username: cleanTargetUsername },
      include: { profile: true },
    });

    if (!targetUser || targetUser.isSuspended) {
      return NextResponse.json({ error: 'User not found or unavailable' }, { status: 404 });
    }

    if (targetUser.id === user.id) {
      return NextResponse.json({ error: 'You cannot start a chat session with yourself' }, { status: 400 });
    }

    // Check if current user already has an active chat
    const userActiveSession = await prisma.chatSession.findFirst({
      where: {
        status: 'ACTIVE',
        OR: [{ userAId: user.id }, { userBId: user.id }],
      },
    });

    if (userActiveSession) {
      return NextResponse.json(
        {
          error: 'Active chat limit reached',
          message: 'You already have an active chat. Finish your current chat before starting another one.',
          activeSessionId: userActiveSession.id,
        },
        { status: 409 }
      );
    }

    // Check if target user has an active chat
    const targetActiveSession = await prisma.chatSession.findFirst({
      where: {
        status: 'ACTIVE',
        OR: [{ userAId: targetUser.id }, { userBId: targetUser.id }],
      },
    });

    if (targetActiveSession) {
      return NextResponse.json(
        {
          error: 'Target user busy',
          message: `@${targetUser.username} currently has an active chat. Please try again later.`,
        },
        { status: 409 }
      );
    }

    // Check block relations
    const isBlocked = await prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: user.id, blockedId: targetUser.id },
          { blockerId: targetUser.id, blockedId: user.id },
        ],
      },
    });

    if (isBlocked) {
      return NextResponse.json({ error: 'Connection unavailable.' }, { status: 403 });
    }


    // Create new active chat session
    const session = await prisma.chatSession.create({
      data: {
        userAId: user.id,
        userBId: targetUser.id,
        status: 'ACTIVE',
        startedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      partner: {
        id: targetUser.id,
        username: targetUser.username,
        displayName: targetUser.displayName || targetUser.fullName,
        avatarUrl: targetUser.profile?.avatarUrl || '/default-avatar.png',
      },
    });
  } catch (error) {
    console.error('Error creating chat session:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
