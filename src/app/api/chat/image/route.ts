import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import fs from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';

function localImageName(key: string): string | null {
  const match = key.match(/^chat-images\/(vip_photo_[A-Za-z0-9._-]+\.(?:jpg|png|webp|gif))$/);
  return match ? match[1] : null;
}

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const key = url.searchParams.get('key') || '';
    if (!/^chat-images\/vip_photo_[A-Za-z0-9._-]+\.(?:jpg|png|webp|gif)$/.test(key)) {
      return NextResponse.json({ error: 'Invalid image reference' }, { status: 400 });
    }

    const imageUrl = `/api/chat/image?key=${encodeURIComponent(key)}`;
    const message = await prisma.message.findFirst({
      where: { imageUrl },
      include: { chatSession: true },
    });

    if (!message || message.chatSession.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Image unavailable' }, { status: 404 });
    }

    const participantIds = [message.chatSession.userAId, message.chatSession.userBId];
    if (!participantIds.includes(user.id) && !participantIds.includes(user.clerkUserId || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const filename = localImageName(key);
    if (!filename) return NextResponse.json({ error: 'Invalid image reference' }, { status: 400 });

    const buffer = await fs.readFile(
      path.join(process.cwd(), 'public', 'uploads', 'chat-images', filename)
    );
    const ext = filename.split('.').pop();
    const contentType =
      ext === 'png' ? 'image/png' :
      ext === 'webp' ? 'image/webp' :
      ext === 'gif' ? 'image/gif' :
      'image/jpeg';

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    });

  } catch (error) {
    console.error('[CHAT_IMAGE] Failed to serve image:', error);
    return NextResponse.json({ error: 'Image unavailable' }, { status: 404 });
  }
}
