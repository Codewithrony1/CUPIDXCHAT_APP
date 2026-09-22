import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireVipUser } from '@/lib/vipAuth';

export async function GET(req: Request) {
  try {
    const { user, response } = await requireVipUser(req);
    if (response || !user) {
      return response;
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q')?.trim().toLowerCase() || '';

    if (!query) {
      return NextResponse.json({ users: [] });
    }

    // Clean query (remove leading @ if provided)
    const cleanQuery = query.startsWith('@') ? query.slice(1) : query;

    if (cleanQuery.length < 2) {
      return NextResponse.json({ users: [] });
    }

    // Fetch matching non-suspended users excluding self
    const matchingUsers = await prisma.user.findMany({
      where: {
        id: { not: user.id },
        isSuspended: false,
        OR: [
          { username: { contains: cleanQuery } },
          { vipUsername: { contains: cleanQuery } },
          { displayName: { contains: cleanQuery } },
          { fullName: { contains: cleanQuery } },
        ],
      },
      take: 10,
      select: {
        id: true,
        username: true,
        vipUsername: true,
        fullName: true,
        displayName: true,
        profile: {
          select: {
            avatarUrl: true,
            isOnline: true,
          },
        },
      },
    });

    const formatted = matchingUsers.map((u) => ({
      id: u.id,
      username: u.vipUsername || u.username,
      displayName: u.displayName || u.fullName,
      avatarUrl: u.profile?.avatarUrl || '/default-avatar.png',
      isOnline: u.profile?.isOnline || false,
    }));

    return NextResponse.json({ users: formatted });
  } catch (error) {
    console.error('Error searching usernames:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
