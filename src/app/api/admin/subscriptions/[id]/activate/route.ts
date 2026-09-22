import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdminAccess } from '@/lib/adminAuth';

export async function POST(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { authorized, user: admin, adminClerkUserId } = await verifyAdminAccess(req);

    if (!authorized) {
      return NextResponse.json({ error: 'Admin authorization required' }, { status: 403 });
    }

    const { id } = await props.params;
    const body = await req.json().catch(() => ({}));
    const days = parseInt((body.days || 30).toString(), 10);

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ id }, { clerkUserId: id }],
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const now = new Date();
    let baseExpiryDate = now;
    if (user.is_vip && user.vip_expires_at && new Date(user.vip_expires_at) > now) {
      baseExpiryDate = new Date(user.vip_expires_at);
    }
    const expiresAt = new Date(baseExpiryDate.getTime() + days * 24 * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        membershipTier: 'VIP',
        is_vip: true,
        vip_started_at: user.vip_started_at || now,
        vip_expires_at: expiresAt,
      },
    });

    const subscription = await prisma.subscription.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        plan: 'VIP',
        isActive: true,
        subscriptionStatus: 'ACTIVE',
        startDate: user.vip_started_at || now,
        endDate: expiresAt,
      },
      update: {
        plan: 'VIP',
        isActive: true,
        subscriptionStatus: 'ACTIVE',
        startDate: user.vip_started_at || now,
        endDate: expiresAt,
      },
    });

    await prisma.adminLog.create({
      data: {
        adminUserId: admin?.id || 'admin',
        adminClerkId: admin?.clerkUserId || null,
        action: 'ACTIVATE_SUBSCRIPTION',
        targetUserId: user.id,
        entityType: 'SUBSCRIPTION',
        entityId: subscription.id,
        details: `Activated VIP for ${user.username} (${days} days) until ${expiresAt.toISOString()}`,
      },
    });

    // Sync Clerk metadata
    try {
      const targetClerkId = user.clerkUserId || user.id;
      if (targetClerkId) {
        const { clerkClient } = await import('@clerk/nextjs/server');
        const client = await clerkClient();
        await client.users.updateUserMetadata(targetClerkId, {
          publicMetadata: {
            is_vip: true,
            membershipTier: 'VIP',
            vip_expires_at: expiresAt.toISOString(),
          },
        });
      }
    } catch (e) {}

    return NextResponse.json({
      success: true,
      message: `Activated VIP subscription for ${user.username}`,
      subscription,
    });
  } catch (error) {
    console.error('Error activating subscription:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
