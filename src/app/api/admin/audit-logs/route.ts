import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdminAccess } from '@/lib/adminAuth';

export async function GET(req: Request) {
  try {
    const { authorized } = await verifyAdminAccess(req);

    if (!authorized) {
      return NextResponse.json({ error: 'Admin authorization required' }, { status: 403 });
    }

    const logs = await prisma.adminLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        admin: {
          select: {
            username: true,
            email: true,
            fullName: true,
          },
        },
      },
    });

    return NextResponse.json({ logs });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
