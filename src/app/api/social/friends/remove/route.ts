import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthUser, getCanonicalPair } from '@/lib/vipAuth';

export async function POST(req: Request) {
  try {
    const { user, response } = await requireAuthUser(req);
    if (response) return response;

    const body = await req.json().catch(() => ({}));
    const { friendId } = body;

    if (!friendId) {
      return NextResponse.json({ error: 'friendId is required.' }, { status: 400 });
    }

    const [u1, u2] = getCanonicalPair(user!.id, friendId);

    await prisma.$transaction([
      prisma.friendship.deleteMany({
        where: { user1Id: u1, user2Id: u2 },
      }),
      prisma.friendRequest.deleteMany({
        where: {
          OR: [
            { senderId: user!.id, receiverId: friendId },
            { senderId: friendId, receiverId: user!.id },
          ],
        },
      }),
    ]);

    return NextResponse.json({ success: true, message: 'Friend removed.' });
  } catch (error: any) {
    console.error('Remove friend error:', error);
    return NextResponse.json({ error: 'Failed to remove friend.' }, { status: 500 });
  }
}
