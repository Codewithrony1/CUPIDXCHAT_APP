import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthUser, getCanonicalPair, checkBlockBetween, isUserVip } from '@/lib/vipAuth';
import { checkRateLimit } from '@/lib/socialRateLimit';

export async function POST(req: Request) {
  try {
    const { user, response } = await requireAuthUser(req);
    if (response) return response;

    // Strict Asymmetric Rule: Only VIP users can initiate calls
    if (!isUserVip(user)) {
      return NextResponse.json(
        {
          error: 'You cannot call this person. Get VIP to chat.',
          isVipRequired: true,
        },
        { status: 403 }
      );
    }

    if (!checkRateLimit(`call_start_${user!.id}`, 6, 60000)) {
      return NextResponse.json({ error: 'Call rate limit reached. Please wait a moment.' }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const { conversationId, callType = 'VOICE', offerSdp } = body;

    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId is required.' }, { status: 400 });
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });
    }

    if (conversation.user1Id !== user!.id && conversation.user2Id !== user!.id) {
      return NextResponse.json({ error: 'Forbidden: You are not a member of this conversation.' }, { status: 403 });
    }

    // Verify active friendship exists
    const [u1, u2] = getCanonicalPair(conversation.user1Id, conversation.user2Id);
    const friendship = await prisma.friendship.findUnique({
      where: { user1Id_user2Id: { user1Id: u1, user2Id: u2 } },
    });
    if (!friendship) {
      return NextResponse.json({ error: 'You must be friends to place calls in this conversation.' }, { status: 403 });
    }

    const receiverId = conversation.user1Id === user!.id ? conversation.user2Id : conversation.user1Id;

    // Check blocks
    const isBlocked = await checkBlockBetween(user!.id, receiverId);
    if (isBlocked) {
      return NextResponse.json({ error: 'Unable to call this user.' }, { status: 403 });
    }

    // Cancel any existing pending calls in this conversation
    await prisma.callSession.updateMany({
      where: {
        conversationId,
        status: { in: ['CALLING', 'RINGING'] },
      },
      data: { status: 'ENDED', endedAt: new Date() },
    });

    // Create new call session
    const callSession = await prisma.callSession.create({
      data: {
        conversationId,
        callerId: user!.id,
        receiverId,
        callType: callType === 'VIDEO' ? 'VIDEO' : 'VOICE',
        status: 'CALLING',
        offerSdp: offerSdp || null,
        iceCandidates: '[]',
      },
    });

    return NextResponse.json({
      success: true,
      callId: callSession.id,
      callSession: {
        id: callSession.id,
        callType: callSession.callType,
        status: callSession.status,
        callerId: callSession.callerId,
        receiverId: callSession.receiverId,
      },
    });
  } catch (error: any) {
    console.error('Start call error:', error);
    return NextResponse.json({ error: 'Failed to start call.' }, { status: 500 });
  }
}
