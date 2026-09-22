import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthUser } from '@/lib/vipAuth';

export async function GET(req: Request) {
  try {
    const { user, response } = await requireAuthUser(req);
    if (response) return response;

    const [incoming, outgoing] = await Promise.all([
      prisma.friendRequest.findMany({
        where: { receiverId: user!.id, status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
        include: {
          sender: {
            select: {
              id: true,
              vipUsername: true,
              username: true,
              displayName: true,
              fullName: true,
              profile: {
                select: {
                  avatarUrl: true,
                  avatarEmoji: true,
                  isOnline: true,
                },
              },
            },
          },
        },
      }),
      prisma.friendRequest.findMany({
        where: { senderId: user!.id, status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
        include: {
          receiver: {
            select: {
              id: true,
              vipUsername: true,
              username: true,
              displayName: true,
              fullName: true,
              profile: {
                select: {
                  avatarUrl: true,
                  avatarEmoji: true,
                  isOnline: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const formattedIncoming = incoming.map((r) => ({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      user: {
        id: r.sender.id,
        username: r.sender.vipUsername || r.sender.username,
        displayName: r.sender.displayName || r.sender.fullName || 'CupidX Member',
        avatarUrl: r.sender.profile?.avatarUrl || null,
        avatarEmoji: r.sender.profile?.avatarEmoji || '😊',
        isOnline: r.sender.profile?.isOnline || false,
      },
    }));

    const formattedOutgoing = outgoing.map((r) => ({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      user: {
        id: r.receiver.id,
        username: r.receiver.vipUsername || r.receiver.username,
        displayName: r.receiver.displayName || r.receiver.fullName || 'CupidX Member',
        avatarUrl: r.receiver.profile?.avatarUrl || null,
        avatarEmoji: r.receiver.profile?.avatarEmoji || '😊',
        isOnline: r.receiver.profile?.isOnline || false,
      },
    }));

    return NextResponse.json({
      incoming: formattedIncoming,
      outgoing: formattedOutgoing,
      pendingCount: formattedIncoming.length,
    });
  } catch (error: any) {
    console.error('Fetch friend requests error:', error);
    return NextResponse.json({ error: 'Failed to fetch friend requests.' }, { status: 500 });
  }
}
