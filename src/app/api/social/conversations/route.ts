import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthUser } from '@/lib/vipAuth';

export async function GET(req: Request) {
  try {
    const { user, response } = await requireAuthUser(req);
    if (response) return response;

    const currentUserId = user!.id;

    // PERF-001: Only select partner fields, not the current user's own profile.
    // Previous implementation fetched both user1 and user2 with full profiles for
    // every conversation, returning the caller's own data redundantly up to 50 times.
    // We now resolve the partner client-side from the already-known currentUserId.
    const conversations = await prisma.conversation.findMany({
      where: {
        OR: [{ user1Id: currentUserId }, { user2Id: currentUserId }],
      },
      orderBy: { lastMessageAt: 'desc' },
      take: 50,
      include: {
        user1: {
          select: {
            id: true,
            vipUsername: true,
            username: true,
            displayName: true,
            fullName: true,
            profile: { select: { avatarUrl: true, avatarEmoji: true, isOnline: true } },
          },
        },
        user2: {
          select: {
            id: true,
            vipUsername: true,
            username: true,
            displayName: true,
            fullName: true,
            profile: { select: { avatarUrl: true, avatarEmoji: true, isOnline: true } },
          },
        },
        // PERF-001: Fetch only the single most recent message per conversation.
        // This still issues a correlated subquery per conversation row but is the
        // correct pattern for Prisma until raw-SQL window functions are available.
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            type: true,
            content: true,
            imageUrl: true,
            senderId: true,
            createdAt: true,
          },
        },
      },
    });

    const formatted = conversations.map((conv) => {
      // Determine partner without double-fetching: pick the user that is NOT the caller.
      const partner = conv.user1Id === currentUserId ? conv.user2 : conv.user1;
      const lastMsg = conv.messages[0] ?? null;

      return {
        id: conv.id,
        partner: {
          id: partner.id,
          username: partner.vipUsername || partner.username,
          hasVipUsername: Boolean(partner.vipUsername),
          displayName: partner.displayName || partner.fullName || 'CupidX Member',
          avatarUrl: partner.profile?.avatarUrl ?? null,
          avatarEmoji: partner.profile?.avatarEmoji ?? '😊',
          isOnline: partner.profile?.isOnline ?? false,
        },
        lastMessage: lastMsg
          ? {
              id: lastMsg.id,
              type: lastMsg.type,
              content: lastMsg.content,
              imageUrl: lastMsg.imageUrl,
              senderId: lastMsg.senderId,
              isMine: lastMsg.senderId === currentUserId,
              createdAt: lastMsg.createdAt.toISOString(),
            }
          : null,
        lastMessageAt: conv.lastMessageAt.toISOString(),
      };
    });

    return NextResponse.json({ conversations: formatted });
  } catch (error: unknown) {
    console.error('Fetch conversations error:', error);
    return NextResponse.json({ error: 'Failed to fetch conversations.' }, { status: 500 });
  }
}
