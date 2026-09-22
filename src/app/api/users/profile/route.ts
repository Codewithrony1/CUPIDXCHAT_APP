import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { checkBlockBetween, isUserVip, DEFAULT_BIO } from '@/lib/vipAuth';

export async function GET(req: Request) {
  try {
    const me = await getCurrentUser(req);
    if (!me) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const username = searchParams.get('username')?.trim().toLowerCase().replace(/^@/, '');

    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    const targetUser = await prisma.user.findFirst({
      where: {
        OR: [{ username }, { vipUsername: username }],
      },
      include: {
        profile: true,
        subscription: true,
      },
    });

    if (!targetUser || targetUser.isSuspended) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (me.id !== targetUser.id) {
      const isBlocked = await checkBlockBetween(me.id, targetUser.id);
      if (isBlocked) {
        return NextResponse.json({ error: 'User unavailable.' }, { status: 404 });
      }
    }

    const isVIP = isUserVip(targetUser);
    const prof = targetUser.profile;

    return NextResponse.json({
      user: {
        id: targetUser.id,
        username: targetUser.vipUsername || targetUser.username,
        vipUsername: targetUser.vipUsername || null,
        displayName: targetUser.displayName || targetUser.fullName,
        isVIP,
        profile: prof
          ? {
              avatarType: prof.avatarType || 'EMOJI',
              avatarEmoji: prof.avatarEmoji || '😊',
              avatarUrl: prof.avatarUrl || null,
              bio: prof.showBio ? (prof.bio || DEFAULT_BIO) : undefined,
              gender: prof.showGender ? prof.gender : undefined,
              mood: prof.showMood ? prof.mood : undefined,
              personalityPreferences: prof.personalityPreferences,
              isOnline: prof.isOnline,
            }
          : null,
      },
    });
  } catch (error) {
    console.error('Error fetching public user profile:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
