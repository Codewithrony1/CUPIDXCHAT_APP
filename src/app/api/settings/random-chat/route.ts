import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const setting = await prisma.appSetting.findUnique({
      where: { key: 'randomChatEnabled' },
    });

    // Default to true if not explicitly set to "false"
    const enabled = setting ? setting.value !== 'false' : true;

    return NextResponse.json({ enabled });
  } catch (error) {
    console.error('Error fetching random chat status:', error);
    // Graceful fallback: keep enabled
    return NextResponse.json({ enabled: true });
  }
}
