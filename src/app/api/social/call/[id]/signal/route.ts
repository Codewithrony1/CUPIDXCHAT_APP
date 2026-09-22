import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthUser } from '@/lib/vipAuth';

export async function GET(
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

    let allCandidates: any[] = [];
    try {
      allCandidates = JSON.parse(session.iceCandidates || '[]');
    } catch (e) {
      allCandidates = [];
    }

    // Only return candidates sent by the OTHER peer
    const partnerCandidates = allCandidates.filter((c) => c.senderId !== user!.id);

    return NextResponse.json({
      status: session.status,
      offerSdp: session.offerSdp,
      answerSdp: session.answerSdp,
      candidates: partnerCandidates,
      durationSec: session.durationSec,
    });
  } catch (error: any) {
    console.error('Call signal error:', error);
    return NextResponse.json({ error: 'Failed to fetch signaling state.' }, { status: 500 });
  }
}
