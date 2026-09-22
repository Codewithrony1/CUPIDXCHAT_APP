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
    const { candidate } = body;

    if (!candidate) {
      return NextResponse.json({ error: 'Candidate is required.' }, { status: 400 });
    }

    const session = await prisma.callSession.findUnique({
      where: { id: callId },
    });

    if (!session) {
      return NextResponse.json({ error: 'Call session not found.' }, { status: 404 });
    }

    if (session.callerId !== user!.id && session.receiverId !== user!.id) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    let list: any[] = [];
    try {
      list = JSON.parse(session.iceCandidates || '[]');
    } catch (e) {
      list = [];
    }

    // Tag candidate with senderId so the receiving peer knows it came from the other side
    list.push({ ...candidate, senderId: user!.id, timestamp: Date.now() });

    await prisma.callSession.update({
      where: { id: callId },
      data: { iceCandidates: JSON.stringify(list) },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('ICE candidate error:', error);
    return NextResponse.json({ error: 'Failed to record ICE candidate.' }, { status: 500 });
  }
}
