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
    const body = await req.json().catch(() => ({}));
    const { answerSdp } = body;

    const session = await prisma.callSession.findUnique({
      where: { id: callId },
    });

    if (!session) {
      return NextResponse.json({ error: 'Call session not found.' }, { status: 404 });
    }

    if (session.receiverId !== user!.id) {
      return NextResponse.json({ error: 'Forbidden: Only receiver can accept the call.' }, { status: 403 });
    }

    if (session.status === 'ENDED' || session.status === 'DECLINED' || session.status === 'MISSED') {
      return NextResponse.json({ error: 'Call is no longer active.' }, { status: 400 });
    }

    const updated = await prisma.callSession.update({
      where: { id: callId },
      data: {
        status: 'ACCEPTED',
        answerSdp: answerSdp || session.answerSdp,
      },
    });

    return NextResponse.json({
      success: true,
      status: updated.status,
      answerSdp: updated.answerSdp,
    });
  } catch (error: any) {
    console.error('Accept call error:', error);
    return NextResponse.json({ error: 'Failed to accept call.' }, { status: 500 });
  }
}
