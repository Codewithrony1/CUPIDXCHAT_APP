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

    if (session.receiverId !== user!.id && session.callerId !== user!.id) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    if (session.status === 'CALLING') {
      await prisma.callSession.update({
        where: { id: callId },
        data: { status: 'RINGING' },
      });
    }

    return NextResponse.json({ success: true, status: 'RINGING' });
  } catch (error: any) {
    console.error('Ring call error:', error);
    return NextResponse.json({ error: 'Failed to update ring status.' }, { status: 500 });
  }
}
