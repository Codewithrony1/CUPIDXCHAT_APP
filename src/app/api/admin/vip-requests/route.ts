import { NextResponse } from 'next/server';
import { verifyAdminAccess } from '@/lib/adminAuth';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const { authorized, user } = await verifyAdminAccess(req);
    if (!authorized) {
      return NextResponse.json({ error: 'Admin authorization required' }, { status: 403 });
    }

    const requests = await prisma.vipRequest.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            fullName: true,
            displayName: true,
            email: true,
            gender: true,
            dob: true,
            membershipTier: true,
            is_vip: true,
            vip_expires_at: true,
          },
        },
      },
    });

    return NextResponse.json({ requests });
  } catch (error) {
    console.error('Error fetching admin VIP requests:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { authorized, user } = await verifyAdminAccess(req);
    if (!authorized) {
      return NextResponse.json({ error: 'Admin authorization required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { requestId, action, rejectionReason } = body;

    if (!requestId || !['APPROVE', 'REJECT'].includes(action)) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    const vipReq = await prisma.vipRequest.findUnique({
      where: { id: requestId },
    });

    if (!vipReq) {
      return NextResponse.json({ error: 'VIP request not found' }, { status: 404 });
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 Days

    if (action === 'APPROVE') {
      // 1. Approve VipRequest
      const updatedReq = await prisma.vipRequest.update({
        where: { id: vipReq.id },
        data: {
          status: 'approved',
          reviewedAt: now,
          reviewedBy: user!.username,
        },
      });

      // 2. Set User is_vip = true, vip_started_at, vip_expires_at
      await prisma.user.update({
        where: { id: vipReq.userId },
        data: {
          is_vip: true,
          membershipTier: 'VIP',
          vip_started_at: now,
          vip_expires_at: expiresAt,
        },
      });

      // 3. Upsert Active Subscription
      await prisma.subscription.upsert({
        where: { userId: vipReq.userId },
        create: {
          userId: vipReq.userId,
          plan: 'VIP',
          isActive: true,
          subscriptionStatus: 'ACTIVE',
          startDate: now,
          endDate: expiresAt,
        },
        update: {
          plan: 'VIP',
          isActive: true,
          subscriptionStatus: 'ACTIVE',
          startDate: now,
          endDate: expiresAt,
        },
      });

      // 4. Log Admin Action in AdminLog audit trail
      await prisma.adminLog.create({
        data: {
          adminUserId: user!.id,
          action: 'APPROVE_VIP',
          targetUserId: vipReq.userId,
          details: `Approved VIP request (${vipReq.method}) for ₹${vipReq.amount}`,
        },
      });

      return NextResponse.json({
        success: true,
        message: 'VIP request approved! 30-day VIP status granted to user.',
        request: updatedReq,
      });
    } else {
      // Reject Action
      const updatedReq = await prisma.vipRequest.update({
        where: { id: vipReq.id },
        data: {
          status: 'rejected',
          rejectionReason: rejectionReason || 'Verification failed. Invalid proof or transaction hash.',
          reviewedAt: now,
          reviewedBy: user!.username,
        },
      });

      // Log Admin Action
      await prisma.adminLog.create({
        data: {
          adminUserId: user!.id,
          action: 'REJECT_VIP',
          targetUserId: vipReq.userId,
          details: `Rejected VIP request (${vipReq.method}). Reason: ${rejectionReason || 'Verification failed'}`,
        },
      });

      return NextResponse.json({
        success: true,
        message: 'VIP request rejected.',
        request: updatedReq,
      });
    }
  } catch (error) {
    console.error('Error processing admin VIP request:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
