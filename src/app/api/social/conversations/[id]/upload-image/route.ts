import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthUser, getCanonicalPair, checkBlockBetween, isUserVip } from '@/lib/vipAuth';
import { checkRateLimit } from '@/lib/socialRateLimit';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, response } = await requireAuthUser(req);
    if (response) return response;

    // Strict Asymmetric Rule: Only VIP users can send messages/photos
    if (!isUserVip(user)) {
      return NextResponse.json(
        {
          error: 'You cannot message this person. Get VIP to chat.',
          isVipRequired: true,
        },
        { status: 403 }
      );
    }

    const { id: conversationId } = await params;

    if (!checkRateLimit(`social_img_${user!.id}`, 8, 60000)) {
      return NextResponse.json({ error: 'Image upload limit reached. Please wait a minute.' }, { status: 429 });
    }

    // Verify conversation existence and participant membership
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });
    }

    if (conversation.user1Id !== user!.id && conversation.user2Id !== user!.id) {
      return NextResponse.json({ error: 'Forbidden: You are not a member of this conversation.' }, { status: 403 });
    }

    // Verify active friendship exists
    const [u1, u2] = getCanonicalPair(conversation.user1Id, conversation.user2Id);
    const friendship = await prisma.friendship.findUnique({
      where: { user1Id_user2Id: { user1Id: u1, user2Id: u2 } },
    });
    if (!friendship) {
      return NextResponse.json({ error: 'You must be friends to upload photos in this conversation.' }, { status: 403 });
    }

    const partnerId = conversation.user1Id === user!.id ? conversation.user2Id : conversation.user1Id;
    const isBlocked = await checkBlockBetween(user!.id, partnerId);
    if (isBlocked) {
      return NextResponse.json({ error: 'Unable to send message to this member.' }, { status: 403 });
    }

    const contentType = req.headers.get('content-type') || '';
    let buffer: Buffer | null = null;
    let ext = 'jpg';
    let textContent = '';

    if (contentType.includes('application/json')) {
      const body = await req.json().catch(() => ({}));
      const { imageData, content } = body;
      textContent = content || '';

      if (!imageData || typeof imageData !== 'string') {
        return NextResponse.json({ error: 'Invalid or missing image data.' }, { status: 400 });
      }

      const matches = imageData.match(/^data:image\/([A-Za-z+]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        return NextResponse.json({ error: 'Invalid base64 image data.' }, { status: 400 });
      }

      const rawExt = matches[1].toLowerCase();
      ext = rawExt === 'jpeg' ? 'jpg' : rawExt === 'png' ? 'png' : rawExt === 'webp' ? 'webp' : rawExt === 'gif' ? 'gif' : 'jpg';
      buffer = Buffer.from(matches[2], 'base64');
    } else if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      textContent = (formData.get('content') as string) || '';

      if (!file) {
        return NextResponse.json({ error: 'No image file uploaded.' }, { status: 400 });
      }

      const arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
      const mime = file.type.toLowerCase();
      ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : mime.includes('gif') ? 'gif' : 'jpg';
    } else {
      return NextResponse.json({ error: 'Unsupported Content-Type. Use multipart/form-data or application/json.' }, { status: 400 });
    }

    if (!buffer || buffer.length === 0) {
      return NextResponse.json({ error: 'Empty file buffer.' }, { status: 400 });
    }

    // Size limit: 5MB
    if (buffer.length > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Image size exceeds the 5MB maximum limit.' }, { status: 400 });
    }

    // Magic bytes validation: strictly enforce image format
    const isPng = buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
    const isJpg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    const isWebp = buffer.length >= 12 && buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;
    const isGif = buffer.length >= 4 && buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38;

    if (!isPng && !isJpg && !isWebp && !isGif) {
      return NextResponse.json(
        { error: 'Invalid file format. Only JPG, JPEG, PNG, WEBP, and GIF images are permitted.' },
        { status: 400 }
      );
    }

    ext = isPng ? 'png' : isWebp ? 'webp' : isGif ? 'gif' : 'jpg';

    // Save image to disk
    const randomKey = crypto.randomBytes(16).toString('hex');
    const filename = `social_img_${Date.now()}_${randomKey}.${ext}`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'chat-images');
    const altUploadDir = path.join(process.cwd(), 'uploads', 'chat-images');

    await fs.mkdir(uploadDir, { recursive: true });
    await fs.mkdir(altUploadDir, { recursive: true }).catch(() => {});

    await Promise.all([
      fs.writeFile(path.join(uploadDir, filename), buffer),
      fs.writeFile(path.join(altUploadDir, filename), buffer).catch(() => {}),
    ]);

    const imageUrl = `/uploads/chat-images/${filename}`;

    // Create PrivateMessage record
    const [message] = await prisma.$transaction([
      prisma.privateMessage.create({
        data: {
          conversationId,
          senderId: user!.id,
          type: 'IMAGE',
          content: textContent.trim(),
          imageUrl,
          status: 'SENT',
        },
        include: {
          sender: { select: { id: true, vipUsername: true, username: true, displayName: true, fullName: true } },
        },
      }),
      prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: new Date() },
      }),
    ]);

    return NextResponse.json({
      success: true,
      imageUrl,
      message: {
        id: message.id,
        conversationId: message.conversationId,
        senderId: message.senderId,
        senderUsername: message.sender.vipUsername || message.sender.username,
        senderDisplayName: message.sender.displayName || message.sender.fullName,
        type: message.type,
        content: message.content,
        imageUrl: message.imageUrl,
        status: message.status,
        createdAt: message.createdAt.toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Private chat image upload error:', error);
    return NextResponse.json({ error: 'Failed to upload photo.' }, { status: 500 });
  }
}
