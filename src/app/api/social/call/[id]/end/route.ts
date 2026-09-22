import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthUser } from '@/lib/vipAuth';

function formatDuration(seconds: number): string {
  if (seconds <= 0) return '0s';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

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

    if (session.callerId !== user!.id && session.receiverId !== user!.id) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    if (session.status === 'ENDED') {
      return NextResponse.json({ message: 'Call already ended.', durationSec: session.durationSec });
    }

    const now = new Date();
    const durationSec = Math.max(0, Math.round((now.getTime() - session.startedAt.getTime()) / 1000));
    const isConnected = session.status === 'ACCEPTED' || session.status === 'CONNECTING' || session.status === 'CONNECTED';

    const icon = session.callType === 'VIDEO' ? '📹' : '📞';
    const logContent = isConnected && durationSec > 0
      ? `${icon} ${session.callType === 'VIDEO' ? 'Video' : 'Voice'} call ended · ${formatDuration(durationSec)}`
      : `${icon} Cancelled ${session.callType.toLowerCase()} call`;

    await prisma.$transaction([
      prisma.callSession.update({
        where: { id: callId },
        data: {
          status: 'ENDED',
          endedAt: now,
          durationSec,
        },
      }),
      prisma.privateMessage.create({
        data: {
          conversationId: session.conversationId,
          senderId: user!.id,
          type: 'CALL_EVENT',
          content: logContent,
        },
      }),
      prisma.conversation.update({
        where: { id: session.conversationId },
        data: { lastMessageAt: now },
      }),
    ]);

    return NextResponse.json({ success: true, durationSec });
  } catch (error: any) {
    console.error('End call error:', error);
    return NextResponse.json({ error: 'Failed to end call.' }, { status: 500 });
  }
}
