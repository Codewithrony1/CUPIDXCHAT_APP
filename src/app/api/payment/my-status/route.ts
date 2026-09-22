import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const latestRequest = await prisma.paymentRequest.findFirst({
      where: {
        OR: [
          { userId: user.id },
          ...(user.clerkUserId ? [{ clerkUserId: user.clerkUserId }] : []),
        ],
      },
      orderBy: { createdAt: 'desc' },
    });

    const isVip = user.is_vip || user.membershipTier === 'VIP' || (user.subscription?.isActive === true && user.subscription?.plan === 'VIP');
    const isUnderReview = latestRequest?.status === 'UNDER_REVIEW' || latestRequest?.status === 'pending';

    return NextResponse.json({
      success: true,
      hasPending: isUnderReview,
      isUnderReview,
      request: latestRequest,
      isVip,
      vipExpiresAt: user.vip_expires_at,
    });
  } catch (error) {
    console.error('Error fetching user payment status:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
