import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdminAccess } from '@/lib/adminAuth';

export async function POST(req: Request) {
  try {
    const { authorized, user } = await verifyAdminAccess(req);

    if (!authorized) {
      return NextResponse.json({ error: 'Admin authorization required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { userId, isSuspended } = body;

    if (!userId || typeof isSuspended !== 'boolean') {
      return NextResponse.json({ error: 'Valid userId and isSuspended boolean required.' }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { isSuspended },
    });

    await prisma.adminLog.create({
      data: {
        adminUserId: user?.id || 'admin',
        adminClerkId: user?.clerkUserId || null,
        action: isSuspended ? 'BAN_USER' : 'UNBAN_USER',
        targetUserId: userId,
        details: `${isSuspended ? 'Suspended' : 'Unbanned'} user @${targetUser.username}`,
      },
    });

    return NextResponse.json({
      success: true,
      message: `User @${targetUser.username} is now ${isSuspended ? 'banned' : 'active'}.`,
      user: updatedUser,
    });
  } catch (error) {
    console.error('Error toggling user suspension:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
