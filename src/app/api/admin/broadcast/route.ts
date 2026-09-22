import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdminAccess } from '@/lib/adminAuth';

export async function POST(req: Request) {
  try {
    const { authorized } = await verifyAdminAccess(req);
    if (!authorized) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { content } = body;

    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    const cleanContent = content.trim();

    const users = await prisma.user.findMany({
      where: { isSuspended: false },
      select: { id: true }
    });

    const notificationData = users.map((u: { id: string }) => ({
      userId: u.id,
      type: 'ADMIN',
      content: cleanContent,
    }));

    if (notificationData.length > 0) {
      await prisma.notification.createMany({
        data: notificationData,
      });
    }

    return NextResponse.json({
      message: `Announcement broadcasted successfully to ${users.length} users.`,
      success: true,
    });
  } catch (error) {
    console.error('Admin broadcast error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
