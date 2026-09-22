import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthUser, getCanonicalPair, checkBlockBetween, isUserVip } from '@/lib/vipAuth';
import { checkRateLimit } from '@/lib/socialRateLimit';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, response } = await requireAuthUser(req);
    if (response) return response;

    const { id: conversationId } = await params;
    const { searchParams } = new URL(req.url);
    const since = searchParams.get('since');

    // Verify conversation existence and user membership
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        user1: {
          select: {
            id: true,
            vipUsername: true,
            username: true,
            displayName: true,
            fullName: true,
            profile: { select: { avatarUrl: true, avatarEmoji: true, isOnline: true } },
          },
        },
        user2: {
          select: {
            id: true,
            vipUsername: true,
            username: true,
            displayName: true,
            fullName: true,
            profile: { select: { avatarUrl: true, avatarEmoji: true, isOnline: true } },
          },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });
    }

    if (conversation.user1Id !== user!.id && conversation.user2Id !== user!.id) {
      return NextResponse.json({ error: 'Forbidden: You are not a member of this conversation.' }, { status: 403 });
    }

    // Verify active friendship exists & check block status concurrently
    const [u1, u2] = getCanonicalPair(conversation.user1Id, conversation.user2Id);
    const partner = conversation.user1Id === user!.id ? conversation.user2 : conversation.user1;

    const [friendship, isBlocked] = await Promise.all([
      prisma.friendship.findUnique({
        where: { user1Id_user2Id: { user1Id: u1, user2Id: u2 } },
      }),
      checkBlockBetween(user!.id, partner.id),
    ]);

    if (!friendship) {
      return NextResponse.json({ error: 'You must be friends to access this conversation.' }, { status: 403 });
    }

    if (isBlocked) {
      return NextResponse.json({ error: 'Unable to communicate with this member.' }, { status: 403 });
    }

    // Incremental filter
    const whereClause: any = { conversationId };
    if (since) {
      const sinceDate = new Date(since);
      if (!isNaN(sinceDate.getTime())) {
        whereClause.createdAt = { gt: sinceDate };
      }
    }

    const messages = await prisma.privateMessage.findMany({
      where: whereClause,
      orderBy: { createdAt: 'asc' },
      take: 100,
      include: {
        sender: {
          select: {
            id: true,
            vipUsername: true,
            username: true,
            displayName: true,
            fullName: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      partner: {
        id: partner.id,
        username: partner.vipUsername || partner.username,
        hasVipUsername: Boolean(partner.vipUsername),
        displayName: partner.displayName || partner.fullName || 'CupidX Member',
        avatarUrl: partner.profile?.avatarUrl || null,
        avatarEmoji: partner.profile?.avatarEmoji || '😊',
        isOnline: partner.profile?.isOnline || false,
      },
      messages: messages.map((m) => ({
        id: m.id,
        clientMessageId: m.clientMessageId,
        conversationId: m.conversationId,
        senderId: m.senderId,
        senderUsername: m.sender.vipUsername || m.sender.username,
        senderDisplayName: m.sender.displayName || m.sender.fullName,
        type: m.type,
        content: m.content,
        imageUrl: m.imageUrl,
        status: m.status,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  } catch (error: any) {
    console.error('Fetch private messages error:', error);
    return NextResponse.json({ error: 'Failed to fetch messages.' }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, response } = await requireAuthUser(req);
    if (response) return response;

    // Strict Asymmetric Rule: Only VIP users can send messages
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

    if (!checkRateLimit(`social_msg_${user!.id}`, 20, 10000)) {
      return NextResponse.json({ error: 'Please slow down. Too many messages.' }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const { content, imageUrl, type = 'TEXT', clientMessageId } = body;

    if (!content?.trim() && !imageUrl && type !== 'CALL_EVENT') {
      return NextResponse.json({ error: 'Message content or image is required.' }, { status: 400 });
    }

    // Verify conversation existence and participant membership
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });
    }

    if (conversation.user1Id !== user!.id && conversation.user2Id !== user!.id) {
      return NextResponse.json({ error: 'Forbidden: You cannot send messages to this conversation.' }, { status: 403 });
    }

    // Verify active friendship exists
    const [u1, u2] = getCanonicalPair(conversation.user1Id, conversation.user2Id);
    const friendship = await prisma.friendship.findUnique({
      where: { user1Id_user2Id: { user1Id: u1, user2Id: u2 } },
    });
    if (!friendship) {
      return NextResponse.json({ error: 'You must be friends to send messages in this conversation.' }, { status: 403 });
    }

    const partnerId = conversation.user1Id === user!.id ? conversation.user2Id : conversation.user1Id;

    // Verify neither user has blocked the other
    const isBlocked = await checkBlockBetween(user!.id, partnerId);
    if (isBlocked) {
      return NextResponse.json({ error: 'Unable to send message to this member.' }, { status: 403 });
    }

    // Idempotency check with clientMessageId
    if (clientMessageId) {
      const existing = await prisma.privateMessage.findFirst({
        where: { clientMessageId, conversationId },
        include: {
          sender: { select: { id: true, vipUsername: true, username: true, displayName: true, fullName: true } },
        },
      });

      if (existing) {
        return NextResponse.json({
          success: true,
          alreadyProcessed: true,
          message: {
            id: existing.id,
            clientMessageId: existing.clientMessageId,
            conversationId: existing.conversationId,
            senderId: existing.senderId,
            senderUsername: existing.sender.vipUsername || existing.sender.username,
            senderDisplayName: existing.sender.displayName || existing.sender.fullName,
            type: existing.type,
            content: existing.content,
            imageUrl: existing.imageUrl,
            status: existing.status,
            createdAt: existing.createdAt.toISOString(),
          },
        });
      }
    }

    // Create message and update conversation timestamp
    const [message] = await prisma.$transaction([
      prisma.privateMessage.create({
        data: {
          conversationId,
          senderId: user!.id,
          type,
          content: (content || '').trim(),
          imageUrl: imageUrl || null,
          clientMessageId: clientMessageId || null,
          status: 'SENT',
        },
        include: {
          sender: {
            select: { id: true, vipUsername: true, username: true, displayName: true, fullName: true },
          },
        },
      }),
      prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: new Date() },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: {
        id: message.id,
        clientMessageId: message.clientMessageId,
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
    console.error('Send private message error:', error);
    return NextResponse.json({ error: 'Failed to send private message.' }, { status: 500 });
  }
}
