import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const requests = await prisma.paymentRequest.findMany({
      where: {
        OR: [
          { userId: user.id },
          ...(user.clerkUserId ? [{ clerkUserId: user.clerkUserId }] : []),
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return NextResponse.json({
      payments: requests.map((p) => ({
        id: p.id,
        requestId: p.requestId,
        paymentId: p.paymentId,
        amount: p.amount,
        currency: p.currency,
        plan: p.plan,
        region: p.region,
        status: p.status,
        rejectionReason: p.rejectionReason,
        screenshotUrl: p.screenshotUrl,
        createdAt: p.createdAt.toISOString(),
        reviewedAt: p.reviewedAt ? p.reviewedAt.toISOString() : null,
      })),
    });
  } catch (error: any) {
    console.error('Fetch Payment History Error:', error);
    return NextResponse.json({ error: 'Failed to fetch payment history' }, { status: 500 });
  }
}
