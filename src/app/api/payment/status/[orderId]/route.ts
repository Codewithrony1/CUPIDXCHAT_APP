import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export async function GET(
  req: Request,
  props: { params: Promise<{ orderId: string }> }
) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orderId } = await props.params;

    const request = await prisma.paymentRequest.findFirst({
      where: {
        OR: [{ id: orderId }, { requestId: orderId }],
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
    console.error('Error fetching payment status by ID:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
