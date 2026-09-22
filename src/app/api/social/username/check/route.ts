import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthUser, validateUsernameFormat } from '@/lib/vipAuth';
import { checkRateLimit } from '@/lib/socialRateLimit';

export async function GET(req: Request) {
  try {
    const { user, response } = await requireAuthUser(req);
    if (response) return response;

    if (!checkRateLimit(`user_check_${user!.id}`, 45, 60000)) {
      return NextResponse.json({ error: 'Too many requests. Please slow down.' }, { status: 429 });
    }

    const { searchParams } = new URL(req.url);
    const rawUsername = searchParams.get('username') || '';

    const validation = validateUsernameFormat(rawUsername);
    if (!validation.valid) {
      return NextResponse.json({
        available: false,
        clean: validation.clean,
        reason: validation.reason,
      });
    }

    const clean = validation.clean;

    // Check if current user already owns this handle
    if (user!.vipUsername === clean) {
      return NextResponse.json({
        available: true,
        clean,
        isCurrent: true,
        message: 'This is your current VIP username.',
      });
    }

    // Check if claimed by another user
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ vipUsername: clean }, { username: clean }],
        NOT: { id: user!.id },
      },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json({
        available: false,
        clean,
        reason: 'This username is already taken. Please try another.',
      });
    }

    return NextResponse.json({
      available: true,
      clean,
      message: 'Username is available!',
    });
  } catch (error: any) {
    console.error('Username check error:', error);
    return NextResponse.json({ error: 'Failed to verify username availability.' }, { status: 500 });
  }
}
