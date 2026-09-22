import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireVipUser, validateUsernameFormat } from '@/lib/vipAuth';
import { checkRateLimit } from '@/lib/socialRateLimit';

export async function POST(req: Request) {
  try {
    const { user, response } = await requireVipUser(req);
    if (response) return response;

    if (!checkRateLimit(`user_claim_${user!.id}`, 5, 60000)) {
      return NextResponse.json({ error: 'Too many username claim attempts. Please wait a moment.' }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const rawUsername = body.username || '';

    const validation = validateUsernameFormat(rawUsername);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.reason }, { status: 400 });
    }

    const clean = validation.clean;

    // Check if already claimed by someone else
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ vipUsername: clean }, { username: clean }],
        NOT: { id: user!.id },
      },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'This username is already taken by another member. Please choose a different one.' },
        { status: 409 }
      );
    }

    // Atomically claim the VIP username
    const updated = await prisma.$transaction(async (tx) => {
      // Re-check inside transaction to prevent parallel race conditions
      const raceCheck = await tx.user.findFirst({
        where: {
          OR: [{ vipUsername: clean }, { username: clean }],
          NOT: { id: user!.id },
        },
        select: { id: true },
      });

      if (raceCheck) {
        throw new Error('COLLISION_TAKEN');
      }

      return tx.user.update({
        where: { id: user!.id },
        data: {
          vipUsername: clean,
          vipUsernameClaimedAt: new Date(),
          username: clean,
        },
        select: {
          id: true,
          vipUsername: true,
          username: true,
          fullName: true,
          displayName: true,
        },
      });
    });

    // 1. Sync Clerk user metadata
    try {
      const targetClerkId = user!.clerkUserId || user!.id;
      if (targetClerkId && targetClerkId.startsWith('user_')) {
        const { clerkClient } = await import('@clerk/nextjs/server');
        const client = await clerkClient();
        await client.users.updateUserMetadata(targetClerkId, {
          publicMetadata: {
            vipUsername: clean,
            username: clean,
          },
        });
      }
    } catch (clerkErr) {
      console.warn('Clerk username sync notice (non-critical):', clerkErr);
    }

    return NextResponse.json({
      success: true,
      username: updated.vipUsername,
      message: `Congratulations! @${updated.vipUsername} is now your official CupidX VIP username.`,
    });
  } catch (error: any) {
    if (error?.message === 'COLLISION_TAKEN') {
      return NextResponse.json(
        { error: 'This username was just claimed by another user. Please choose another.' },
        { status: 409 }
      );
    }
    console.error('Username claim error:', error);
    return NextResponse.json({ error: 'Failed to claim username. Please try again.' }, { status: 500 });
  }
}
