import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthUser, getCanonicalPair, checkBlockBetween, isUserVip } from '@/lib/vipAuth';
import { checkRateLimit } from '@/lib/socialRateLimit';

export async function POST(req: Request) {
  try {
    const { user, response } = await requireAuthUser(req);
    if (response) return response;

    // Verify sender is VIP
    if (!isUserVip(user)) {
      return NextResponse.json(
        {
          error: 'Only VIP members can send friend requests.',
          isVipRequired: true,
        },
        { status: 403 }
      );
    }

    if (!checkRateLimit(`friend_req_${user!.id}`, 10, 60000)) {
      return NextResponse.json({ error: 'Friend request rate limit reached. Please wait a minute.' }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const { targetUserId, targetUsername } = body;

    if (!targetUserId && !targetUsername) {
      return NextResponse.json({ error: 'Target user identifier is required.' }, { status: 400 });
    }

    // Resolve target user with VIP membership details
    let targetUser = null;
    const selectFields = {
      id: true,
      isSuspended: true,
      vipUsername: true,
      username: true,
      is_vip: true,
      membershipTier: true,
      subscription: true,
    };

    if (targetUserId) {
      targetUser = await prisma.user.findUnique({
        where: { id: targetUserId },
        select: selectFields,
      });
    } else {
      const cleanUsername = targetUsername.toLowerCase().trim().replace(/^@/, '');
      targetUser = await prisma.user.findFirst({
        where: { OR: [{ vipUsername: cleanUsername }, { username: cleanUsername }] },
        select: selectFields,
      });
    }

    if (!targetUser || targetUser.isSuspended) {
      return NextResponse.json({ error: 'User not found or unavailable.' }, { status: 404 });
    }

    if (targetUser.id === user!.id) {
      return NextResponse.json({ error: 'You cannot send a friend request to yourself.' }, { status: 400 });
    }

    // Check block status
    const isBlocked = await checkBlockBetween(user!.id, targetUser.id);
    if (isBlocked) {
      return NextResponse.json({ error: 'Unable to send friend request.' }, { status: 403 });
    }

    // Check existing friendship
    const [u1, u2] = getCanonicalPair(user!.id, targetUser.id);
    const existingFriendship = await prisma.friendship.findUnique({
      where: { user1Id_user2Id: { user1Id: u1, user2Id: u2 } },
    });

    if (existingFriendship) {
      return NextResponse.json({ error: 'You are already friends with this member.' }, { status: 400 });
    }

    // Check existing pending request
    const existingRequest = await prisma.friendRequest.findFirst({
      where: {
        OR: [
          { senderId: user!.id, receiverId: targetUser.id },
          { senderId: targetUser.id, receiverId: user!.id },
        ],
      },
    });

    if (existingRequest) {
      if (existingRequest.status === 'PENDING') {
        if (existingRequest.senderId === user!.id) {
          return NextResponse.json({ error: 'Friend request is already pending.' }, { status: 400 });
        } else {
          // The other user already sent a request to us! Auto-accept into friendship!
          const [cu1, cu2] = getCanonicalPair(user!.id, targetUser.id);
          const [friendship] = await prisma.$transaction([
            prisma.friendship.upsert({
              where: { user1Id_user2Id: { user1Id: cu1, user2Id: cu2 } },
              update: {},
              create: { user1Id: cu1, user2Id: cu2 },
            }),
            prisma.friendRequest.update({
              where: { id: existingRequest.id },
              data: { status: 'ACCEPTED' },
            }),
            prisma.conversation.upsert({
              where: { user1Id_user2Id: { user1Id: cu1, user2Id: cu2 } },
              update: {},
              create: { user1Id: cu1, user2Id: cu2 },
            }),
          ]);

          return NextResponse.json({
            success: true,
            autoAccepted: true,
            message: `You and @${targetUser.vipUsername || targetUser.username} are now friends!`,
            friendshipId: friendship.id,
          });
        }
      }

      // If previous request was rejected or cancelled, update to PENDING
      const updatedRequest = await prisma.friendRequest.update({
        where: { id: existingRequest.id },
        data: {
          senderId: user!.id,
          receiverId: targetUser.id,
          status: 'PENDING',
        },
      });

      return NextResponse.json({
        success: true,
        requestId: updatedRequest.id,
        message: 'Friend request sent successfully!',
      });
    }

    // Create new friend request
    const newRequest = await prisma.friendRequest.create({
      data: {
        senderId: user!.id,
        receiverId: targetUser.id,
        status: 'PENDING',
      },
    });

    return NextResponse.json({
      success: true,
      requestId: newRequest.id,
      message: 'Friend request sent successfully!',
    });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({
        success: true,
        message: 'Friend request is already pending.',
      });
    }
    console.error('Send friend request error:', error);
    return NextResponse.json({ error: 'Failed to send friend request.' }, { status: 500 });
  }
}
