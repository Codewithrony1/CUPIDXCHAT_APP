import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, getOrCreateUserFromClerk } from '@/lib/auth';
import { sanitizeMessage, MAX_MESSAGE_LENGTH } from '@/lib/sanitize';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

// Rate limiting in-memory map: userId -> array of timestamps
const userMessageRateMap = new Map<string, number[]>();

async function resolveCanonicalUserId(identifier: string, displayName = 'Stranger'): Promise<string> {
  if (!identifier) return identifier;
  try {
    const existing = await prisma.user.findFirst({
      where: { OR: [{ id: identifier }, { clerkUserId: identifier }] },
      select: { id: true },
    });
    if (existing) {
      return existing.id;
    }
    const suffix = Math.random().toString(36).slice(2, 6);
    const created = await prisma.user.create({
      data: {
        id: identifier,
        clerkUserId: identifier,
        username: `user_${identifier.slice(-6)}_${suffix}`,
        fullName: displayName,
        displayName: displayName,
        gender: 'unspecified',
        profile: {
          create: {
            gender: 'unspecified',
            avatarEmoji: '😊',
          },
        },
      },
      select: { id: true },
    });
    return created.id;
  } catch (e) {
    console.error('[resolveCanonicalUserId] Error resolving/creating user:', e);
    const fallback = await prisma.user.findFirst({
      where: { OR: [{ id: identifier }, { clerkUserId: identifier }] },
      select: { id: true },
    });
    return fallback ? fallback.id : identifier;
  }
}

// Send a message in a ChatSession with Idempotency, Rate Limiting & VIP Image Verification
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { chatSessionId, content, imageUrl: rawImageUrl, imageData, clientMessageId, clerkUserId } = body;

    // 1. Authenticate user strictly
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Please log in first.' }, { status: 401 });
    }

    // 2. Server-side Rate Limiting (Max 6 messages per 3 seconds per user)
    const now = Date.now();
    const timestamps = userMessageRateMap.get(user.id) || [];
    const recentTimestamps = timestamps.filter((t) => now - t < 3000);

    if (recentTimestamps.length >= 6) {
      return NextResponse.json(
        { error: 'Too many messages. Please slow down.' },
        { status: 429 }
      );
    }
    recentTimestamps.push(now);
    userMessageRateMap.set(user.id, recentTimestamps);

    if (!chatSessionId || (!content?.trim() && !rawImageUrl && !imageData)) {
      return NextResponse.json({ error: 'Chat session ID and content or image are required' }, { status: 400 });
    }

    // MSG-001: Enforce message length limit and sanitize before ANY further processing.
    // The 2000-char cap matches what socket/server.js enforces on the WebSocket path.
    if (content !== undefined && content !== null && typeof content === 'string') {
      if (content.trim().length > MAX_MESSAGE_LENGTH) {
        return NextResponse.json(
          { error: `Message too long. Maximum length is ${MAX_MESSAGE_LENGTH} characters.` },
          { status: 400 }
        );
      }
    }

    // 3. Strict IDOR Check: Verify ChatSession exists and user is a participant
    let session = await prisma.chatSession.findUnique({
      where: { id: chatSessionId },
      include: {
        userA: { select: { id: true, clerkUserId: true } },
        userB: { select: { id: true, clerkUserId: true } },
      },
    });

    if (!session) {
      return NextResponse.json({ error: 'Chat session not found' }, { status: 404 });
    }

    const userIds = [user.id, user.clerkUserId].filter(Boolean) as string[];
    const isParticipant =
      userIds.includes(session.userAId) ||
      userIds.includes(session.userBId) ||
      (session.userA && (userIds.includes(session.userA.id) || (session.userA.clerkUserId && userIds.includes(session.userA.clerkUserId)))) ||
      (session.userB && (userIds.includes(session.userB.id) || (session.userB.clerkUserId && userIds.includes(session.userB.clerkUserId))));

    if (!isParticipant) {
      return NextResponse.json({ error: 'Forbidden: You are not a participant in this chat' }, { status: 403 });
    }

    if (session.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Chat session has already ended' }, { status: 400 });
    }

    // 4. VIP Image Verification & Secure Image Processing
    let finalImageUrl: string | null = rawImageUrl || null;
    const isSendingImage = Boolean(rawImageUrl || imageData);

    if (isSendingImage) {
      const isVIP = user.is_vip || user.membershipTier === 'VIP' || (user.subscription?.isActive === true && user.subscription?.plan === 'VIP');
      if (!isVIP) {
        return NextResponse.json(
          {
            error: 'Image sharing is an exclusive CupidX VIP feature. Upgrade to VIP to send photos in chat.',
            isVipRequired: true,
          },
          { status: 403 }
        );
      }

      if (imageData && imageData.startsWith('data:image/')) {
        const matches = imageData.match(/^data:image\/([A-Za-z+]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const rawExt = matches[1].toLowerCase();
          let ext = rawExt === 'jpeg' ? 'jpg' : (rawExt === 'png' ? 'png' : (rawExt === 'webp' ? 'webp' : 'jpg'));
          const base64Data = matches[2];
          const buffer = Buffer.from(base64Data, 'base64');

          if (buffer.length > 5 * 1024 * 1024) {
            return NextResponse.json({ error: 'Image size exceeds 5MB limit.' }, { status: 400 });
          }

          // Magic Bytes Check
          const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
          const isJpg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
          const isWebp = buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46;
          const isGif = buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38;

          if (!isPng && !isJpg && !isWebp && !isGif) {
            return NextResponse.json({ error: 'Invalid file format. Only JPG, JPEG, PNG, WEBP, and GIF image files are allowed.' }, { status: 400 });
          }

          ext = isPng ? 'png' : (isWebp ? 'webp' : (isGif ? 'gif' : 'jpg'));

          const randomKey = crypto.randomBytes(12).toString('hex');
          const filename = `chat_img_${Date.now()}_${randomKey}.${ext}`;
          const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'chat-images');
          await fs.mkdir(uploadDir, { recursive: true });

          await fs.writeFile(path.join(uploadDir, filename), buffer);
          finalImageUrl = `/uploads/chat-images/${filename}`;
        }
      }
    }

    // 5. Idempotency Check: Prevent duplicate messages during network retries
    if (clientMessageId) {
      const existingMessage = await prisma.message.findFirst({
        where: { clientMessageId },
        include: {
          sender: { select: { username: true, displayName: true, fullName: true } },
        },
      });

      if (existingMessage) {
        return NextResponse.json({
          success: true,
          alreadyProcessed: true,
          message: {
            id: existingMessage.id,
            clientMessageId: existingMessage.clientMessageId,
            chatSessionId: existingMessage.chatSessionId,
            senderId: existingMessage.senderId,
            senderUsername: existingMessage.sender.displayName || existingMessage.sender.fullName || 'Stranger',
            content: existingMessage.content,
            imageUrl: existingMessage.imageUrl,
            createdAt: existingMessage.createdAt.toISOString(),
          },
        });
      }
    }

    // 6. Sanitize message content (MSG-001: prevent stored XSS)
    const { safe: safeContent, tooLong } = sanitizeMessage(content);
    if (tooLong) {
      return NextResponse.json(
        { error: `Message too long. Maximum length is ${MAX_MESSAGE_LENGTH} characters.` },
        { status: 400 }
      );
    }

    // 7. Create Message record in DB
    const message = await prisma.message.create({
      data: {
        chatSessionId,
        clientMessageId: clientMessageId || null,
        senderId: user.id,
        content: safeContent,
        imageUrl: finalImageUrl,
      },
      include: {
        sender: {
          select: { username: true, displayName: true, fullName: true },
        },
      },
    });

    const nowMs = Date.now();
    const senderDisplayName = user.displayName || user.fullName || user.username || 'Stranger';
    const messageDocId = message.id || clientMessageId || `msg_${nowMs}`;

    return NextResponse.json({
      success: true,
      message: {
        id: message.id,
        clientMessageId: message.clientMessageId,
        chatSessionId: message.chatSessionId,
        senderId: message.senderId,
        senderUsername: message.sender.displayName || message.sender.fullName || 'Stranger',
        content: message.content,
        imageUrl: message.imageUrl,
        createdAt: message.createdAt.toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Send message error:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}

// Fetch messages & partner status for a ChatSession
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const chatSessionId = searchParams.get('chatSessionId');
    const since = searchParams.get('since');

    if (!chatSessionId) {
      return NextResponse.json({ error: 'chatSessionId parameter is required' }, { status: 400 });
    }

    // Strict Authorization Check
    let session = await prisma.chatSession.findUnique({
      where: { id: chatSessionId },
      include: {
        userA: { include: { profile: true } },
        userB: { include: { profile: true } },
      },
    });

    if (!session) {
      return NextResponse.json({ error: 'Chat session not found', sessionStatus: 'PENDING' }, { status: 404 });
    }

    const userIds = [user.id, user.clerkUserId].filter(Boolean) as string[];
    const isParticipant =
      userIds.includes(session.userAId) ||
      userIds.includes(session.userBId) ||
      (session.userA && (userIds.includes(session.userA.id) || (session.userA.clerkUserId && userIds.includes(session.userA.clerkUserId)))) ||
      (session.userB && (userIds.includes(session.userB.id) || (session.userB.clerkUserId && userIds.includes(session.userB.clerkUserId))));

    if (!isParticipant) {
      return NextResponse.json({ error: 'Forbidden: Access denied' }, { status: 403 });
    }

    const isUserA = userIds.includes(session.userAId) || (session.userA && (userIds.includes(session.userA.id) || (session.userA.clerkUserId && userIds.includes(session.userA.clerkUserId))));
    const partner = isUserA ? session.userB : session.userA;
    const isPartnerVIP = Boolean(partner?.membershipTier === 'VIP' || partner?.is_vip);

    const messageWhere: any = { chatSessionId };
    if (since) {
      const sinceDate = new Date(since);
      if (!isNaN(sinceDate.getTime())) {
        messageWhere.createdAt = { gt: sinceDate };
      }
    }

    const rawMessages = await prisma.message.findMany({
      where: messageWhere,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        sender: {
          select: { username: true, displayName: true, fullName: true },
        },
      },
    });

    const finalMessages = rawMessages.reverse().map((m) => ({
      id: m.id,
      clientMessageId: m.clientMessageId,
      chatSessionId: m.chatSessionId,
      senderId: m.senderId,
      senderUsername: m.sender.displayName || m.sender.fullName || m.sender.username || 'Stranger',
      content: m.content,
      imageUrl: m.imageUrl,
      sequenceNumber: m.createdAt.getTime(),
      status: m.deliveredAt ? 'DELIVERED' : m.status,
      deliveredAt: m.deliveredAt ? m.deliveredAt.toISOString() : null,
      createdAt: m.createdAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      sessionStatus: session.status,
      partner: partner
        ? {
            id: partner.id,
            username: partner.username || 'user',
            displayName: partner.displayName || partner.fullName || 'Stranger',
            gender: partner.profile?.gender || partner.gender || 'unspecified',
            avatarEmoji: partner.profile?.avatarEmoji || '😊',
            avatarUrl: partner.profile?.avatarUrl || null,
            isVIP: isPartnerVIP,
          }
        : null,
      messages: finalMessages,
    });
  } catch (error: any) {
    console.error('Get messages error:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}
