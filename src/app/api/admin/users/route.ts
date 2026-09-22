import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdminAccess } from '@/lib/adminAuth';
import { clerkClient } from '@clerk/nextjs/server';

export async function GET(req: Request) {
  try {
    const { authorized } = await verifyAdminAccess(req);

    if (!authorized) {
      return NextResponse.json({ error: 'Admin authorization required' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const search = (searchParams.get('search') || '').toLowerCase().trim();
    const planFilter = (searchParams.get('plan') || 'all').toLowerCase();

    // Ensure the admin view can discover Clerk-linked accounts even when some users
    // have not yet completed their first authenticated database sync.
    // The database remains the canonical application store; Clerk identity is linked
    // through clerkUserId/email whenever a matching account exists.
    const localUsers = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        profile: true,
        subscription: true,
      },
    });

    let mergedUsers = localUsers.map((u) => {
      // Keep the admin response type stable even if a cached/generated Prisma client
      // is temporarily behind the current schema. clerkUserId is optional by design.
      const clerkUserId = (u as { clerkUserId?: string | null }).clerkUserId ?? null;
      const isVip = u.is_vip || u.membershipTier === 'VIP' || (u.subscription?.isActive === true && u.subscription?.plan === 'VIP');

      return {
        id: u.id,
        clerkUserId,
        username: u.username || 'user',
        vipUsername: u.vipUsername || null,
        vipUsernameClaimedAt: u.vipUsernameClaimedAt || null,
        fullName: u.fullName || u.username,
        email: u.email || null,
        membershipTier: isVip ? 'VIP' : 'FREE',
        is_vip: isVip,
        vip_expires_at: u.vip_expires_at,
        isSuspended: u.isSuspended,
        createdAt: u.createdAt,
        profile: u.profile,
        avatarUrl: u.profile?.avatarUrl || null,
        avatarType: u.profile?.avatarType || null,
        subscription: u.subscription,
      };
    });

    // Apply Filters
    if (search) {
      mergedUsers = mergedUsers.filter(
        (u) =>
          u.username.toLowerCase().includes(search) ||
          (u.email && u.email.toLowerCase().includes(search)) ||
          u.fullName.toLowerCase().includes(search) ||
          (u.clerkUserId && u.clerkUserId.toLowerCase().includes(search))
      );
    }

    if (planFilter === 'vip') {
      mergedUsers = mergedUsers.filter((u) => u.is_vip);
    } else if (planFilter === 'free') {
      mergedUsers = mergedUsers.filter((u) => !u.is_vip);
    }

    return NextResponse.json({ users: mergedUsers });
  } catch (error) {
    console.error('Error fetching admin users list:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
