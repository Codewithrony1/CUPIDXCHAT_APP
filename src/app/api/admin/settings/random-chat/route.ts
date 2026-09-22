import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdminAccess } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { authorized } = await verifyAdminAccess(req);
    if (!authorized) {
      return NextResponse.json({ error: 'Admin authorization required' }, { status: 403 });
    }

    const setting = await prisma.appSetting.findUnique({
      where: { key: 'randomChatEnabled' },
    });

    const enabled = setting ? setting.value !== 'false' : true;

    return NextResponse.json({ enabled });
  } catch (error) {
    console.error('Error in admin GET random-chat setting:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { authorized, user: admin } = await verifyAdminAccess(req);
    if (!authorized) {
      return NextResponse.json({ error: 'Admin authorization required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { enabled } = body;

    if (typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'Invalid enabled parameter. Expected boolean.' }, { status: 400 });
    }

    const valueStr = enabled ? 'true' : 'false';

    // 1. Update in Prisma AppSetting
    await prisma.appSetting.upsert({
      where: { key: 'randomChatEnabled' },
      update: { value: valueStr },
      create: { key: 'randomChatEnabled', value: valueStr },
    });

    // 2. Write Admin Audit Log
    try {
      await prisma.adminLog.create({
        data: {
          adminUserId: admin?.id || 'admin',
          action: enabled ? 'ENABLE_RANDOM_CHAT' : 'DISABLE_RANDOM_CHAT',
          entityType: 'SETTING',
          entityId: 'randomChatEnabled',
          details: `Admin ${admin?.username || 'admin'} turned Random Chat ${enabled ? 'ON' : 'OFF'}.`,
        },
      });
    } catch (logErr) {}

    return NextResponse.json({
      success: true,
      enabled,
      message: `Random Matchmaking is now ${enabled ? 'ENABLED (ON)' : 'DISABLED (OFF)'}.`,
    });
  } catch (error) {
    console.error('Error in admin POST random-chat setting:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
