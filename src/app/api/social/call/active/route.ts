import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthUser } from '@/lib/vipAuth';

export async function GET(req: Request) {
  try {
    const { user, response } = await requireAuthUser(req);
    if (response) return response;

    // Prune expired ringing calls older than 45 seconds
    const staleCutoff = new Date(Date.now() - 45 * 1000);
    const staleCalls = await prisma.callSession.findMany({
      where: {
        status: { in: ['CALLING', 'RINGING'] },
        startedAt: { lt: staleCutoff },
        OR: [{ callerId: user!.id }, { receiverId: user!.id }],
      },
    });

    for (const stale of staleCalls) {
      await prisma.$transaction([
        prisma.callSession.update({
          where: { id: stale.id },
          data: { status: 'MISSED', endedAt: new Date() },
        }),
        prisma.privateMessage.create({
          data: {
            conversationId: stale.conversationId,
            senderId: stale.callerId,
            type: 'CALL_EVENT',
            content: `Missed ${stale.callType.toLowerCase()} call`,
          },
        }),
      ]);
    }

    // Find current active or incoming call
    const activeCall = await prisma.callSession.findFirst({
      where: {
        status: { in: ['CALLING', 'RINGING', 'ACCEPTED', 'CONNECTING', 'CONNECTED'] },
        OR: [{ callerId: user!.id }, { receiverId: user!.id }],
      },
      orderBy: { startedAt: 'desc' },
      include: {
        caller: {
          select: {
            id: true,
            vipUsername: true,
            username: true,
            displayName: true,
            fullName: true,
            profile: { select: { avatarUrl: true, avatarEmoji: true } },
          },
        },
        receiver: {
          select: {
            id: true,
            vipUsername: true,
            username: true,
            displayName: true,
            fullName: true,
            profile: { select: { avatarUrl: true, avatarEmoji: true } },
          },
        },
      },
    });

    if (!activeCall) {
      return NextResponse.json({ activeCall: null });
    }

    const isIncoming = activeCall.receiverId === user!.id && activeCall.status === 'CALLING';
    const otherUser = activeCall.callerId === user!.id ? activeCall.receiver : activeCall.caller;

    return NextResponse.json({
      activeCall: {
        id: activeCall.id,
        conversationId: activeCall.conversationId,
        callType: activeCall.callType,
        status: activeCall.status,
        isCaller: activeCall.callerId === user!.id,
        isIncoming,
        startedAt: activeCall.startedAt.toISOString(),
        offerSdp: activeCall.offerSdp,
        answerSdp: activeCall.answerSdp,
        otherUser: {
          id: otherUser.id,
          username: otherUser.vipUsername || otherUser.username,
          displayName: otherUser.displayName || otherUser.fullName || 'CupidX Member',
          avatarUrl: otherUser.profile?.avatarUrl || null,
          avatarEmoji: otherUser.profile?.avatarEmoji || '😊',
        },
      },
    });
  } catch (error: any) {
    console.error('Fetch active call error:', error);
    return NextResponse.json({ error: 'Failed to fetch active call.' }, { status: 500 });
  }
}
