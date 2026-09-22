import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthUser, getCanonicalPair, isUserVip } from '@/lib/vipAuth';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, response } = await requireAuthUser(req);
    if (response) return response;

    const { id: requestId } = await params;

    const request = await prisma.friendRequest.findUnique({
      where: { id: requestId },
      include: {
        sender: {
          select: {
            id: true,
            vipUsername: true,
            username: true,
            displayName: true,
            is_vip: true,
            membershipTier: true,
            subscription: true,
          },
        },
      },
    });

    if (!request) {
      return NextResponse.json({ error: 'Friend request not found.' }, { status: 404 });
    }

    if (request.receiverId !== user!.id) {
      return NextResponse.json({ error: 'Forbidden: You are not the recipient of this request.' }, { status: 403 });
    }

    // Verify sender is VIP (Free users can accept friend requests from VIP users)
    if (!isUserVip(request.sender)) {
      return NextResponse.json(
        {
          error: 'The sender is no longer an active VIP member.',
          isVipRequired: true,
        },
        { status: 403 }
      );
    }

    if (request.status === 'ACCEPTED') {
      return NextResponse.json({ message: 'Friend request already accepted.' });
    }

    if (request.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Friend request is no longer valid or has been cancelled.' },
        { status: 400 }
      );
    }

    const [u1, u2] = getCanonicalPair(user!.id, request.senderId);

    // Atomically accept request, create friendship, and create or get conversation
    const result = await prisma.$transaction(async (tx) => {
      // 1. Mark request accepted
      await tx.friendRequest.update({
        where: { id: requestId },
        data: { status: 'ACCEPTED' },
      });

      // 2. Create friendship (ignore if already exists)
      const friendship = await tx.friendship.upsert({
        where: { user1Id_user2Id: { user1Id: u1, user2Id: u2 } },
        update: {},
        create: { user1Id: u1, user2Id: u2 },
      });

      // 3. Upsert conversation
      const conversation = await tx.conversation.upsert({
        where: { user1Id_user2Id: { user1Id: u1, user2Id: u2 } },
        update: {},
        create: { user1Id: u1, user2Id: u2 },
      });

      // 4. Initial system message
      await tx.privateMessage.create({
        data: {
          conversationId: conversation.id,
          senderId: user!.id,
          type: 'SYSTEM',
          content: 'You are now connected on CupidX! Start your private conversation.',
        },
      });

      return { friendship, conversation };
    });

    return NextResponse.json({
      success: true,
      conversationId: result.conversation.id,
      message: `Friend request accepted! You and @${request.sender.vipUsername || request.sender.username} are now friends.`,
    });
  } catch (error: any) {
    console.error('Accept friend request error:', error);
    return NextResponse.json({ error: 'Failed to accept friend request.' }, { status: 500 });
  }
}
