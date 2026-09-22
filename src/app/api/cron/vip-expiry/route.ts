import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdminAccess } from '@/lib/adminAuth';

export async function GET(req: Request) {
  try {
    // 1. Authorize: Require valid CRON_SECRET or Admin access
    const authHeader = req.headers.get('authorization');
    const url = new URL(req.url);
    const querySecret = url.searchParams.get('secret');
    const cronSecret = process.env.CRON_SECRET || 'cupidx_cron_internal_secret_key';

    const hasValidSecret =
      (authHeader && authHeader === `Bearer ${cronSecret}`) ||
      (querySecret && querySecret === cronSecret);

    if (!hasValidSecret) {
      const { authorized } = await verifyAdminAccess(req);
      if (!authorized) {
        return NextResponse.json({ error: 'Unauthorized cron access' }, { status: 401 });
      }
    }

    const now = new Date();

    // 2. Find users whose VIP status or subscription has expired
    const expiredUsers = await prisma.user.findMany({
      where: {
        OR: [
          { is_vip: true, vip_expires_at: { lte: now } },
          { membershipTier: 'VIP', vip_expires_at: { lte: now } },
          {
            subscription: {
              isActive: true,
              OR: [
                { endDate: { lte: now } },
                { currentPeriodEnd: { lte: now } },
              ],
            },
          },
        ],
      },
      select: { id: true, username: true },
    });

    if (expiredUsers.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No expired VIP subscriptions found.',
        count: 0,
      });
    }

    const expiredUserIds = expiredUsers.map((u) => u.id);

    // 3. Set is_vip = false, membershipTier = 'FREE'
    await prisma.user.updateMany({
      where: {
        id: { in: expiredUserIds },
      },
      data: {
        is_vip: false,
        membershipTier: 'FREE',
      },
    });

    // 4. Deactivate Subscriptions
    await prisma.subscription.updateMany({
      where: {
        userId: { in: expiredUserIds },
      },
      data: {
        isActive: false,
        subscriptionStatus: 'EXPIRED',
      },
    });

    return NextResponse.json({
      success: true,
      message: `Successfully expired ${expiredUsers.length} VIP subscriptions.`,
      count: expiredUsers.length,
      expiredUsers,
    });
  } catch (error) {
    console.error('Error executing VIP auto-expiry cron:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
