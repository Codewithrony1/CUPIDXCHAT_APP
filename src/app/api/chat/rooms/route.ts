import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Retrieve active/past chat sessions for the user ordered by startedAt newest
    const sessions = await prisma.chatSession.findMany({
      where: {
        OR: [{ userAId: user.id }, { userBId: user.id }],
      },
      orderBy: {
        startedAt: 'desc',
      },
      include: {
        userA: {
          select: {
            id: true,
            username: true,
            fullName: true,
            displayName: true,
            profile: { select: { avatarUrl: true, avatarEmoji: true, isOnline: true } },
          },
        },
        userB: {
          select: {
            id: true,
            username: true,
            fullName: true,
            displayName: true,
            profile: { select: { avatarUrl: true, avatarEmoji: true, isOnline: true } },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    const rooms = sessions.map((session) => {
      const partner = session.userAId === user.id ? session.userB : session.userA;
      const lastMessage = session.messages[0] || null;

      return {
        id: session.id,
        partner: {
          id: partner.id,
          username: partner.username,
          displayName: partner.displayName || partner.fullName,
          avatarUrl: partner.profile?.avatarUrl || null,
          avatarEmoji: partner.profile?.avatarEmoji || '😊',
          isOnline: partner.profile?.isOnline || false,
        },
        lastMessage: lastMessage
          ? {
              content: lastMessage.content,
              createdAt: lastMessage.createdAt.toISOString(),
              senderId: lastMessage.senderId,
            }
          : null,
        startedAt: session.startedAt.toISOString(),
        status: session.status,
      };
    });

    return NextResponse.json({ rooms });
  } catch (error) {
    console.error('Chat rooms fetch error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
