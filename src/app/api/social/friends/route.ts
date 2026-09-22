import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthUser, getCanonicalPair } from '@/lib/vipAuth';

export async function GET(req: Request) {
  try {
    const { user, response } = await requireAuthUser(req);
    if (response) return response;

    // Fetch friendships where user is user1 or user2
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [{ user1Id: user!.id }, { user2Id: user!.id }],
      },
      include: {
        user1: {
          select: {
            id: true,
            vipUsername: true,
            username: true,
            displayName: true,
            fullName: true,
            profile: {
              select: {
                avatarUrl: true,
                avatarEmoji: true,
                isOnline: true,
                lastSeen: true,
                bio: true,
              },
            },
          },
        },
        user2: {
          select: {
            id: true,
            vipUsername: true,
            username: true,
            displayName: true,
            fullName: true,
            profile: {
              select: {
                avatarUrl: true,
                avatarEmoji: true,
                isOnline: true,
                lastSeen: true,
                bio: true,
              },
            },
          },
        },
      },
    });

    // Check blocks
    const blocks = await prisma.block.findMany({
      where: {
        OR: [{ blockerId: user!.id }, { blockedId: user!.id }],
      },
      select: { blockerId: true, blockedId: true },
    });
    const blockedUserIds = new Set(
      blocks.map((b) => (b.blockerId === user!.id ? b.blockedId : b.blockerId))
    );

    // Map friends
    const friends = friendships
      .map((f) => {
        const friend = f.user1Id === user!.id ? f.user2 : f.user1;
        const [u1, u2] = getCanonicalPair(user!.id, friend.id);

        return {
          friendshipId: f.id,
          friend: {
            id: friend.id,
            username: friend.vipUsername || friend.username,
            hasVipUsername: Boolean(friend.vipUsername),
            displayName: friend.displayName || friend.fullName || 'CupidX Member',
            avatarUrl: friend.profile?.avatarUrl || null,
            avatarEmoji: friend.profile?.avatarEmoji || '😊',
            isOnline: friend.profile?.isOnline || false,
            lastSeen: friend.profile?.lastSeen || null,
            bio: friend.profile?.bio || '',
          },
          createdAt: f.createdAt.toISOString(),
          canonicalPair: { u1, u2 },
        };
      })
      .filter((item) => !blockedUserIds.has(item.friend.id));

    if (friends.length === 0) {
      return NextResponse.json({ friends: [] });
    }

    // Get conversation IDs for these friends
    const pairs = friends.map((f) => f.canonicalPair);
    const conversations = await prisma.conversation.findMany({
      where: {
        OR: pairs.map((p) => ({ user1Id: p.u1, user2Id: p.u2 })),
      },
      select: { id: true, user1Id: true, user2Id: true },
    });

    const convMap = new Map<string, string>();
    for (const c of conversations) {
      convMap.set(`${c.user1Id}:${c.user2Id}`, c.id);
    }

    const finalFriends = friends.map((f) => ({
      friendshipId: f.friendshipId,
      friend: f.friend,
      conversationId: convMap.get(`${f.canonicalPair.u1}:${f.canonicalPair.u2}`) || null,
      createdAt: f.createdAt,
    }));

    return NextResponse.json({ friends: finalFriends });
  } catch (error: any) {
    console.error('Fetch friends error:', error);
    return NextResponse.json({ error: 'Failed to fetch friends.' }, { status: 500 });
  }
}
