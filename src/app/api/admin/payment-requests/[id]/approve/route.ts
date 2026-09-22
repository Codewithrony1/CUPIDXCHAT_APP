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
    if (!id) {
      return NextResponse.json({ error: 'Payment request ID required' }, { status: 400 });
    }

    const paymentRequest = await prisma.paymentRequest.findFirst({
      where: {
        OR: [{ id }, { requestId: id }],
      },
      include: {
        user: true,
      },
    });

    if (!paymentRequest) {
      return NextResponse.json({ error: 'Payment request not found' }, { status: 404 });
    }

    if (paymentRequest.status === 'APPROVED' || paymentRequest.status === 'approved') {
      return NextResponse.json({ error: 'Payment request has already been approved' }, { status: 400 });
    }

    const now = new Date();
    const planNormalized = (paymentRequest.plan || '').toLowerCase();
    const amount = Number(paymentRequest.amount) || 0;

    // Determine duration based on plan or amount (₹29 = 30 days, ₹99 = 90 days, ₹399 = 365 days)
    let durationDays = 30;
    if (planNormalized.includes('year') || planNormalized === '365days' || amount === 399) {
      durationDays = 365;
    } else if (planNormalized.includes('3month') || planNormalized.includes('three') || amount === 99) {
      durationDays = 90;
    } else {
      durationDays = 30;
    }

    const targetUser = paymentRequest.user;
    let baseExpiryDate = now;

    // Extend active subscriptions if not expired
    if (targetUser && targetUser.is_vip && targetUser.vip_expires_at && new Date(targetUser.vip_expires_at) > now) {
      baseExpiryDate = new Date(targetUser.vip_expires_at);
    }

    const newExpiresAt = new Date(baseExpiryDate.getTime() + durationDays * 24 * 60 * 60 * 1000);
    const adminIdentifier = admin?.username || adminClerkUserId || admin?.id || 'admin';
    const formattedExpiryDate = newExpiresAt.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    // 1. Atomic Database Updates
    await prisma.$transaction([
      prisma.paymentRequest.update({
        where: { id: paymentRequest.id },
        data: {
          status: 'APPROVED',
          reviewedBy: adminIdentifier,
          reviewedAt: now,
        },
      }),
      prisma.user.update({
        where: { id: paymentRequest.userId },
        data: {
          membershipTier: 'VIP',
          is_vip: true,
          vip_started_at: targetUser.vip_started_at || now,
          vip_expires_at: newExpiresAt,
        },
      }),
      prisma.subscription.upsert({
        where: { userId: paymentRequest.userId },
        update: {
          plan: 'VIP',
          isActive: true,
          subscriptionStatus: 'ACTIVE',
          startDate: targetUser.vip_started_at || now,
          endDate: newExpiresAt,
        },
        create: {
          userId: paymentRequest.userId,
          plan: 'VIP',
          isActive: true,
          subscriptionStatus: 'ACTIVE',
          startDate: now,
          endDate: newExpiresAt,
        },
      }),
      prisma.notification.create({
        data: {
          userId: paymentRequest.userId,
          type: 'PAYMENT_APPROVED',
          content: `👑 VIP Activated! Your payment for ${paymentRequest.plan || 'VIP Plan'} was verified. Active until ${formattedExpiryDate}.`,
        },
      }),
      prisma.adminLog.create({
        data: {
          adminUserId: admin?.id || 'admin',
          adminClerkId: admin?.clerkUserId || null,
          action: 'APPROVE_PAYMENT',
          targetUserId: paymentRequest.userId,
          entityType: 'PAYMENT',
          entityId: paymentRequest.id,
          details: `Approved payment request ${paymentRequest.requestId || paymentRequest.id} for @${targetUser.username} (${targetUser.email || 'no-email'}) by ${adminIdentifier}. Duration: ${durationDays} days. Expiry: ${newExpiresAt.toISOString()}`,
        },
      }),
    ]);

    // 2. Sync to Clerk User publicMetadata
    try {
      const targetClerkId = targetUser.clerkUserId || paymentRequest.clerkUserId || targetUser.id;
      if (targetClerkId) {
        const { clerkClient } = await import('@clerk/nextjs/server');
        const client = await clerkClient();
        await client.users.updateUserMetadata(targetClerkId, {
          publicMetadata: {
            is_vip: true,
            membershipTier: 'VIP',
            vip_expires_at: newExpiresAt.toISOString(),
          },
        });
      }
    } catch (clerkSyncErr) {
      console.warn('Clerk metadata sync warning during payment approval:', clerkSyncErr);
    }

    return NextResponse.json({
      success: true,
      message: 'Payment approved and VIP activated successfully',
      vip_expires_at: newExpiresAt,
    });
  } catch (error) {
    console.error('Error approving payment request:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
