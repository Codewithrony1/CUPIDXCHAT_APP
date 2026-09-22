import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const notifications = await prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    return NextResponse.json({ notifications });
  } catch (error) {
    console.error('Notifications fetch error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { notificationId } = body;

    if (notificationId) {
      await prisma.notification.updateMany({
        where: {
          id: notificationId,
          userId: user.id
        },
        data: { isRead: true }
      });
    } else {
      await prisma.notification.updateMany({
        where: {
          userId: user.id,
          isRead: false
        },
        data: { isRead: true }
      });
    }

    return NextResponse.json({ message: 'Notifications updated successfully', success: true });
  } catch (error) {
    console.error('Notifications update error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
