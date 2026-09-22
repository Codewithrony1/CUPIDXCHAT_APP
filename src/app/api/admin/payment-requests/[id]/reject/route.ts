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

    const body = await req.json().catch(() => ({}));
    const reason = body.reason || 'Payment verification failed. UTR or screenshot does not match received transaction.';

    const paymentRequest = await prisma.paymentRequest.findFirst({
      where: {
        OR: [{ id }, { requestId: id }],
      },
    });

    if (!paymentRequest) {
      return NextResponse.json({ error: 'Payment request not found' }, { status: 404 });
    }

    const now = new Date();
    const adminIdentifier = admin?.username || adminClerkUserId || admin?.id || 'admin';

    // Update request to REJECTED and create notification
    await prisma.$transaction([
      prisma.paymentRequest.update({
        where: { id: paymentRequest.id },
        data: {
          status: 'REJECTED',
          rejectionReason: reason,
          reviewedAt: now,
          reviewedBy: adminIdentifier,
        },
      }),
      prisma.notification.create({
        data: {
          userId: paymentRequest.userId,
          type: 'PAYMENT_REJECTED',
          content: `❌ Payment Request Rejected: Your payment (${paymentRequest.requestId || 'CPX'}) could not be verified. Reason: ${reason}`,
        },
      }),
      prisma.adminLog.create({
        data: {
          adminUserId: admin?.id || 'admin',
          adminClerkId: admin?.clerkUserId || null,
          action: 'REJECT_PAYMENT',
          targetUserId: paymentRequest.userId,
          entityType: 'PAYMENT',
          entityId: paymentRequest.id,
          details: `Rejected payment request ${paymentRequest.requestId || paymentRequest.id} by ${adminIdentifier}. Reason: ${reason}`,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: 'Payment request rejected',
    });
  } catch (error) {
    console.error('Error rejecting payment request:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
