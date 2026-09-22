import { NextResponse } from 'next/server';
import { verifyAdminAccess } from '@/lib/adminAuth';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const { authorized } = await verifyAdminAccess(req);
    if (!authorized) {
      return NextResponse.json({ error: 'Admin authorization required' }, { status: 403 });
    }

    const reports = await prisma.report.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        reporter: {
          select: { username: true, displayName: true },
        },
        reported: {
          select: { username: true, displayName: true, gender: true, dob: true },
        },
      },
    });

    const reportedUserIds = Array.from(new Set(reports.map((report) => report.reportedUserId)));
    const moderationEvents = reportedUserIds.length
      ? await prisma.moderationEvent.findMany({
          where: { userId: { in: reportedUserIds } },
          orderBy: { createdAt: 'desc' },
          take: 500,
        })
      : [];

    return NextResponse.json({ reports, moderationEvents });
  } catch (error) {
    console.error('Error fetching admin reports:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
