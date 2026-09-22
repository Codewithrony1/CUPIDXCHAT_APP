import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthUser } from '@/lib/vipAuth';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, response } = await requireAuthUser(req);
    if (response) return response;

    const { id: callId } = await params;

    const session = await prisma.callSession.findUnique({
      where: { id: callId },
    });

    if (!session) {
      return NextResponse.json({ error: 'Call session not found.' }, { status: 404 });
    }

    if (session.receiverId !== user!.id) {
      return NextResponse.json({ error: 'Forbidden: Only receiver can decline the call.' }, { status: 403 });
    }

    const now = new Date();
    const icon = session.callType === 'VIDEO' ? '📹' : '📞';

    await prisma.$transaction([
      prisma.callSession.update({
        where: { id: callId },
        data: {
          status: 'DECLINED',
          endedAt: now,
        },
      }),
      prisma.privateMessage.create({
        data: {
          conversationId: session.conversationId,
          senderId: user!.id,
          type: 'CALL_EVENT',
          content: `${icon} Declined ${session.callType.toLowerCase()} call`,
        },
      }),
      prisma.conversation.update({
        where: { id: session.conversationId },
        data: { lastMessageAt: now },
      }),
    ]);

    return NextResponse.json({ success: true, status: 'DECLINED' });
  } catch (error: any) {
    console.error('Decline call error:', error);
    return NextResponse.json({ error: 'Failed to decline call.' }, { status: 500 });
  }
}
