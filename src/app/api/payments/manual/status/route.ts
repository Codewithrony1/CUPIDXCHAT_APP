import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const paymentId = searchParams.get('paymentId');

    if (!paymentId) {
      // Get latest payment for this user
      const latestPayment = await prisma.manualUpiPayment.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
      });
      return NextResponse.json({ payment: latestPayment });
    }

    const payment = await prisma.manualUpiPayment.findFirst({
      where: {
        OR: [{ paymentId }, { id: paymentId }],
        userId: user.id,
      },
    });

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    return NextResponse.json({ payment });
  } catch (error) {
    console.error('Error fetching payment status:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
