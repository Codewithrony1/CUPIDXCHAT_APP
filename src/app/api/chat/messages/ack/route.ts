import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { messageId, clientMessageId, chatSessionId } = body;

    if (!messageId && !clientMessageId) {
      return NextResponse.json({ error: 'messageId or clientMessageId is required' }, { status: 400 });
    }

    if (!chatSessionId) return NextResponse.json({ error: 'chatSessionId is required' }, { status: 400 });
    const ackMessage = await prisma.message.findFirst({
      where: { ...(messageId ? { id: messageId } : { clientMessageId }), chatSessionId },
      include: { chatSession: true },
    });
    if (!ackMessage) return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    if (ackMessage.chatSession.status !== 'ACTIVE') return NextResponse.json({ error: 'Chat session is no longer active' }, { status: 400 });
    if (ackMessage.senderId === user.id) return NextResponse.json({ error: 'Sender cannot acknowledge their own message' }, { status: 403 });
    if (![ackMessage.chatSession.userAId, ackMessage.chatSession.userBId].includes(user.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const now = new Date();
    const nowIso = now.toISOString();

    // 1. Update local database if record is present on this container
    try {
      const message = await prisma.message.findFirst({
        where: {
          OR: [
            ...(messageId ? [{ id: messageId }] : []),
            ...(clientMessageId ? [{ clientMessageId }] : []),
          ],
          ...(chatSessionId ? { chatSessionId } : {}),
        },
      });

      if (message && !message.deliveredAt) {
        await prisma.message.update({
          where: { id: message.id },
          data: { deliveredAt: now },
        });
      }
    } catch (dbErr) {
      console.warn('[ACK_ROUTE] Local DB ack update notice:', dbErr);
    }

    return NextResponse.json({
      success: true,
      deliveredAt: nowIso,
    });
  } catch (error: any) {
    console.error('Ack message error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
