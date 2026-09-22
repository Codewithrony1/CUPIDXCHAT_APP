import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdminAccess } from '@/lib/adminAuth';

export async function GET(req: Request) {
  try {
    const { authorized } = await verifyAdminAccess(req);

    if (!authorized) {
      return NextResponse.json({ error: 'Admin authorization required' }, { status: 403 });
    }

    const totalUsers = await prisma.user.count();
    const vipUsers = await prisma.user.count({
      where: {
        OR: [
          { is_vip: true },
          { membershipTier: 'VIP' },
        ],
      },
    });

    const pendingRequests = await prisma.paymentRequest.count({
      where: { status: 'pending' },
    });

    const approvedRequests = await prisma.paymentRequest.count({
      where: { status: 'approved' },
    });

    const activeChats = await prisma.chatSession.count({
      where: { status: 'ACTIVE' },
    });

    const totalMessages = await prisma.message.count().catch(() => 0);

    return NextResponse.json({
      stats: {
        totalUsers,
        vipUsers,
        pendingRequests,
        approvedRequests,
        activeChats,
        totalMessages,
      },
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
