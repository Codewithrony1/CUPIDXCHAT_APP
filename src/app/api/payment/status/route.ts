import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const requestId = searchParams.get('requestId') || searchParams.get('orderId');

    if (!requestId) {
      // Return latest payment request for this user
      const latestRequest = await prisma.paymentRequest.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
      });
      if (!latestRequest) {
        return NextResponse.json({ error: 'No payment submissions found' }, { status: 404 });
      }

      const isApproved = latestRequest.status === 'APPROVED' || latestRequest.status === 'approved';
      return NextResponse.json({
        success: true,
        requestId: latestRequest.requestId,
        status: latestRequest.status,
        isApproved,
        plan: latestRequest.plan,
        amount: latestRequest.amount,
        currency: latestRequest.currency,
        createdAt: latestRequest.createdAt,
      });
    }

    const request = await prisma.paymentRequest.findFirst({
      where: {
        OR: [{ id: requestId }, { requestId }],
        userId: user.id,
      },
    });

    if (!request) {
      return NextResponse.json({ error: 'Payment request not found' }, { status: 404 });
    }

    const isApproved = request.status === 'APPROVED' || request.status === 'approved';

    return NextResponse.json({
      success: true,
      requestId: request.requestId,
      status: request.status,
      isApproved,
      plan: request.plan,
      amount: request.amount,
      currency: request.currency,
      createdAt: request.createdAt,
    });
  } catch (error) {
    console.error('Error fetching payment status:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
