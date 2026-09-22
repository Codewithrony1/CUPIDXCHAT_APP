import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const targetUsername = searchParams.get('username');

    if (!targetUsername) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    const cleanUsername = targetUsername.toLowerCase().trim().replace(/^@/, '');

    const targetUser = await prisma.user.findFirst({
      where: {
        OR: [{ username: cleanUsername }, { vipUsername: cleanUsername }],
      },
      include: { profile: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check block status
    const blockRelation = await prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: user.id, blockedId: targetUser.id },
          { blockerId: targetUser.id, blockedId: user.id },
        ],
      },
    });

    const isBlocked = !!blockRelation;
    const blockedByMe = blockRelation ? blockRelation.blockerId === user.id : false;

    // Canonical pair for Conversation table (u1 < u2)
    const [u1, u2] = user.id < targetUser.id ? [user.id, targetUser.id] : [targetUser.id, user.id];

    // Primary: fetch from Conversation and PrivateMessage
    const conversation = await prisma.conversation.findUnique({
      where: {
        user1Id_user2Id: { user1Id: u1, user2Id: u2 },
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 200,
          include: {
            sender: {
              select: {
                id: true,
                username: true,
                fullName: true,
              },
            },
          },
        },
      },
    });

    let formattedMessages: any[] = [];

    if (conversation && conversation.messages.length > 0) {
      formattedMessages = conversation.messages.map((m) => ({
        id: m.id,
        senderId: m.senderId,
        receiverId: m.senderId === user.id ? targetUser.id : user.id,
        content: m.content,
        imageUrl: m.imageUrl,
        isRead: m.status === 'READ',
        isDeleted: false,
        createdAt: m.createdAt.toISOString(),
        sender: {
          id: m.sender.id,
          username: m.sender.username,
          fullName: m.sender.fullName,
        },
      }));

      // Asynchronously mark incoming unread messages as READ
      setImmediate(async () => {
        try {
          await prisma.privateMessage.updateMany({
            where: {
              conversationId: conversation.id,
              senderId: targetUser.id,
              status: 'SENT',
            },
            data: { status: 'READ' },
          });
        } catch (e) {}
      });
    } else if (user?.profile?.saveChatHistory && targetUser?.profile?.saveChatHistory) {
      // Opt-in fallback: only check ChatSession if both users explicitly opted into saveChatHistory
      const session = await prisma.chatSession.findFirst({
        where: {
          OR: [
            { userAId: user.id, userBId: targetUser.id },
            { userAId: targetUser.id, userBId: user.id },
          ],
        },
        orderBy: { startedAt: 'desc' },
      });

      if (session) {
        const legacyMsgs = await prisma.message.findMany({
          where: { chatSessionId: session.id },
          orderBy: { createdAt: 'asc' },
          take: 200,
          include: {
            sender: {
              select: {
                id: true,
                username: true,
                fullName: true,
              },
            },
          },
        });

        formattedMessages = legacyMsgs.map((m) => ({
          id: m.id,
          senderId: m.senderId,
          receiverId: m.senderId === user.id ? targetUser.id : user.id,
          content: m.content,
          imageUrl: m.imageUrl,
          isRead: true,
          isDeleted: false,
          createdAt: m.createdAt.toISOString(),
          sender: {
            id: m.sender.id,
            username: m.sender.username,
            fullName: m.sender.fullName,
          },
        }));
      }
    }

    return NextResponse.json({
      messages: formattedMessages,
      targetUser: {
        id: targetUser.id,
        username: targetUser.vipUsername || targetUser.username,
        fullName: targetUser.fullName,
        displayName: targetUser.displayName || targetUser.fullName,
        avatarUrl: targetUser.profile?.avatarUrl || '/default-avatar.png',
        avatarEmoji: targetUser.profile?.avatarEmoji || '😊',
        isOnline: targetUser.profile?.isOnline || false,
        isVIP: Boolean(targetUser.is_vip || targetUser.membershipTier === 'VIP'),
        bio: targetUser.profile?.bio || '',
        age: targetUser.profile?.age || 18,
        gender: targetUser.profile?.gender || 'unspecified',
        interests: targetUser.profile?.interests || '',
      },
      isBlocked,
      blockedByMe,
    });
  } catch (error) {
    console.error('Chat history error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
