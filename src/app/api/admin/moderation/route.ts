import { NextResponse } from 'next/server';
import { verifyAdminAccess } from '@/lib/adminAuth';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const { authorized } = await verifyAdminAccess(req);
    if (!authorized) {
      return NextResponse.json({ error: 'Admin authorization required' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const risk = (searchParams.get('risk') || '').trim().toUpperCase();
    const userId = (searchParams.get('userId') || '').trim();
    const limit = Math.min(Math.max(Number(searchParams.get('limit') || 100), 1), 500);

    const events = await prisma.moderationEvent.findMany({
      where: {
        ...(risk ? { risk } : {}),
        ...(userId ? { userId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const userIds = Array.from(new Set(events.map((event) => event.userId)));
    const users = userIds.length
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, username: true, email: true, isSuspended: true },
        })
      : [];
    const usersById = new Map(users.map((user) => [user.id, user]));

    return NextResponse.json({
      events: events.map((event) => ({
        ...event,
        user: usersById.get(event.userId) || null,
      })),
    });
  } catch (error) {
    console.error('Error fetching moderation events:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
