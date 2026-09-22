import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthUser, getCanonicalPair, isUserVip } from '@/lib/vipAuth';
import { checkRateLimit } from '@/lib/socialRateLimit';

export async function GET(req: Request) {
  try {
    const { user, response } = await requireAuthUser(req);
    if (response) return response;

    // Strict VIP enforcement: Only VIP users can search and discover members
    if (!isUserVip(user)) {
      return NextResponse.json(
        {
          error: 'VIP membership required to search and discover members.',
          isVipRequired: true,
        },
        { status: 403 }
      );
    }

    if (!checkRateLimit(`user_search_${user!.id}`, 30, 60000)) {
      return NextResponse.json({ error: 'Search rate limit reached. Please slow down.' }, { status: 429 });
    }

    const { searchParams } = new URL(req.url);
    const query = (searchParams.get('q') || '').toLowerCase().trim().replace(/^@/, '');

    if (!query || query.length < 2) {
      return NextResponse.json({ users: [] });
    }

    // Get blocked user IDs for current user to exclude
    const blocks = await prisma.block.findMany({
      where: {
        OR: [{ blockerId: user!.id }, { blockedId: user!.id }],
      },
      select: { blockerId: true, blockedId: true },
    });

    const blockedUserIds = new Set(
      blocks.map((b) => (b.blockerId === user!.id ? b.blockedId : b.blockerId))
    );

    // Search users matching username, vipUsername, or displayName
    const foundUsers = await prisma.user.findMany({
      where: {
        NOT: { id: user!.id },
        isSuspended: false,
        OR: [
          { vipUsername: { contains: query } },
          { username: { contains: query } },
          { displayName: { contains: query } },
        ],
      },
      take: 20,
      select: {
        id: true,
        vipUsername: true,
        username: true,
        displayName: true,
        fullName: true,
        membershipTier: true,
        is_vip: true,
        profile: {
          select: {
            avatarUrl: true,
            avatarEmoji: true,
            isOnline: true,
            bio: true,
          },
        },
      },
    });

    // Exclude blocked users
    const filtered = foundUsers.filter((u) => !blockedUserIds.has(u.id));

    // Determine friendship / request status for each user
    const userIds = filtered.map((u) => u.id);

    // 1. Check existing friendships
    const canonicalPairs = userIds.map((targetId) => getCanonicalPair(user!.id, targetId));
    const existingFriendships = await prisma.friendship.findMany({
      where: {
        OR: canonicalPairs.map(([u1, u2]) => ({ user1Id: u1, user2Id: u2 })),
      },
    });
    const friendIdSet = new Set(
      existingFriendships.flatMap((f) => [f.user1Id, f.user2Id]).filter((id) => id !== user!.id)
    );

    // 2. Check pending friend requests
    const pendingRequests = await prisma.friendRequest.findMany({
      where: {
        status: 'PENDING',
        OR: [
          { senderId: user!.id, receiverId: { in: userIds } },
          { receiverId: user!.id, senderId: { in: userIds } },
        ],
      },
    });

    const sentReqMap = new Map<string, string>(); // targetId -> requestId
    const receivedReqMap = new Map<string, string>(); // senderId -> requestId
    for (const req of pendingRequests) {
      if (req.senderId === user!.id) {
        sentReqMap.set(req.receiverId, req.id);
      } else {
        receivedReqMap.set(req.senderId, req.id);
      }
    }

    const results = filtered.map((u) => {
      let relationshipStatus: 'FRIENDS' | 'REQUEST_SENT' | 'REQUEST_RECEIVED' | 'NONE' = 'NONE';
      let requestId: string | null = null;

      if (friendIdSet.has(u.id)) {
        relationshipStatus = 'FRIENDS';
      } else if (sentReqMap.has(u.id)) {
        relationshipStatus = 'REQUEST_SENT';
        requestId = sentReqMap.get(u.id)!;
      } else if (receivedReqMap.has(u.id)) {
        relationshipStatus = 'REQUEST_RECEIVED';
        requestId = receivedReqMap.get(u.id)!;
      }

      return {
        id: u.id,
        username: u.vipUsername || u.username,
        hasVipUsername: Boolean(u.vipUsername),
        displayName: u.displayName || u.fullName || 'CupidX Member',
        avatarUrl: u.profile?.avatarUrl || null,
        avatarEmoji: u.profile?.avatarEmoji || '😊',
        isOnline: u.profile?.isOnline || false,
        bio: u.profile?.bio || '',
        relationshipStatus,
        requestId,
      };
    });

    return NextResponse.json({ users: results });
  } catch (error: any) {
    console.error('Social user search error:', error);
    return NextResponse.json({ error: 'Failed to search users.' }, { status: 500 });
  }
}
