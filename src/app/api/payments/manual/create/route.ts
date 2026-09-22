import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const amount = body.amount ? parseFloat(body.amount) : 99.0;
    const planName = body.planName || 'VIP Membership';

    const paymentId = `LEX-UPI-${Math.floor(100000 + Math.random() * 900000)}`;

    const manualPayment = await prisma.manualUpiPayment.create({
      data: {
        paymentId,
        userId: user.id,
        merchantName: 'Lexino Enterprises',
        amount,
        planName,
        status: 'PENDING_PAYMENT',
      },
    });

    return NextResponse.json({
      success: true,
      payment: manualPayment,
    });
  } catch (error) {
    console.error('Error creating manual UPI payment:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
