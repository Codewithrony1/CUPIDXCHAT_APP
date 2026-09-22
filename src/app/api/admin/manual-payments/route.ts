import { NextResponse } from 'next/server';
import { verifyAdminAccess } from '@/lib/adminAuth';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const { authorized, user } = await verifyAdminAccess(req);
    if (!authorized) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const payments = await prisma.manualUpiPayment.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            fullName: true,
            displayName: true,
            membershipTier: true,
          },
        },
      },
    });

    return NextResponse.json({ payments });
  } catch (error) {
    console.error('Error fetching admin manual payments:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { authorized, user } = await verifyAdminAccess(req);
    if (!authorized) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { id, action, rejectionReason } = body;

    if (!id || !['APPROVE', 'REJECT'].includes(action)) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    const payment = await prisma.manualUpiPayment.findUnique({
      where: { id },
    });

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    if (action === 'APPROVE') {
      // 1. Update Payment Status to PAID
      const updatedPayment = await prisma.manualUpiPayment.update({
        where: { id: payment.id },
        data: {
          status: 'PAID',
          reviewedByUserId: user!.id,
          reviewedAt: new Date(),
        },
      });

      // 2. Unlock VIP Membership for User
      const now = new Date();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await prisma.user.update({
        where: { id: payment.userId },
        data: {
          is_vip: true,
          membershipTier: 'VIP',
          vip_started_at: now,
          vip_expires_at: expiresAt,
        },
      });

      // 3. Update or Create Active Subscription
      await prisma.subscription.upsert({
        where: { userId: payment.userId },
        create: {
          userId: payment.userId,
          plan: 'VIP',
          isActive: true,
          subscriptionStatus: 'ACTIVE',
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days VIP
        },
        update: {
          plan: 'VIP',
          isActive: true,
          subscriptionStatus: 'ACTIVE',
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Payment approved successfully! VIP access unlocked.',
        payment: updatedPayment,
      });
    } else {
      // Reject Action
      const updatedPayment = await prisma.manualUpiPayment.update({
        where: { id: payment.id },
        data: {
          status: 'REJECTED',
          rejectionReason: rejectionReason || 'Payment verification failed or invalid UTR.',
          reviewedByUserId: user!.id,
          reviewedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Payment request rejected.',
        payment: updatedPayment,
      });
    }
  } catch (error) {
    console.error('Error processing manual payment action:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
