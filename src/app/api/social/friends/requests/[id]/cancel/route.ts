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

    const { id: requestId } = await params;

    const request = await prisma.friendRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      return NextResponse.json({ error: 'Friend request not found.' }, { status: 404 });
    }

    if (request.senderId !== user!.id) {
      return NextResponse.json({ error: 'Forbidden: You are not the sender of this request.' }, { status: 403 });
    }

    await prisma.friendRequest.update({
      where: { id: requestId },
      data: { status: 'CANCELLED' },
    });

    return NextResponse.json({ success: true, message: 'Friend request cancelled.' });
  } catch (error: any) {
    console.error('Cancel friend request error:', error);
    return NextResponse.json({ error: 'Failed to cancel friend request.' }, { status: 500 });
  }
}
