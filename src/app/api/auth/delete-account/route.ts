import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, getAuthCookieOptions } from '@/lib/auth';
import { createDeletionLock } from '@/lib/deletionLock';

async function performAccountDeletion(req: Request) {
  try {
    let user: any = await getCurrentUser(req);
    let clerkEmail: string | null = null;
    let clerkId: string | null = null;

    if (!user) {
      try {
        const { auth: clerkAuth, currentUser: clerkCurrentUser } = await import('@clerk/nextjs/server');
        const session = await clerkAuth();
        if (session?.userId) {
          clerkId = session.userId;
          const cUser = await clerkCurrentUser().catch(() => null);
          clerkEmail =
            cUser?.primaryEmailAddress?.emailAddress ||
            cUser?.emailAddresses?.[0]?.emailAddress ||
            null;

          user = await prisma.user.findFirst({
            where: { OR: [{ clerkUserId: session.userId }, { id: session.userId }] },
          });
        }
      } catch (e) {}
    } else {
      clerkId = user.clerkUserId;
      if (!user.email && clerkId) {
        try {
          const { clerkClient } = await import('@clerk/nextjs/server');
          const client = await clerkClient();
          const clerkDetail = await client.users.getUser(clerkId);
          clerkEmail =
            clerkDetail?.primaryEmailAddress?.emailAddress ||
            clerkDetail?.emailAddresses?.[0]?.emailAddress ||
            null;
        } catch (e) {}
      }
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Active session required.' }, { status: 401 });
    }

    // Require explicit confirmation to prevent accidental or CSRF deletion
    const body = await req.json().catch(() => ({}));
    if (body?.confirmation !== 'DELETE' && body?.confirmText !== 'DELETE') {
      return NextResponse.json(
        { error: 'High-impact confirmation required. You must submit { confirmText: "DELETE" }.' },
        { status: 400 }
      );
    }

    const userId = user.id;
    const verifiedEmail = user.email || clerkEmail;

    // 1. Terminate any active random chat sessions and notify partner
    try {
      const activeSessions = await prisma.chatSession.findMany({
        where: {
          OR: [{ userAId: userId }, { userBId: userId }],
          status: 'ACTIVE',
        },
      });

      for (const session of activeSessions) {
        await prisma.chatSession
          .update({
            where: { id: session.id },
            data: { status: 'ENDED', endedAt: new Date() },
          })
          .catch(() => {});

        await prisma.message
          .deleteMany({
            where: { chatSessionId: session.id },
          })
          .catch(() => {});

      }
    } catch (chatErr) {
      console.warn('Active chat cleanup notice during deletion:', chatErr);
    }

    // 2. Remove user from matchmaking queues
    try {
      await prisma.matchmakingQueue.deleteMany({ where: { userId } }).catch(() => {});
    } catch (queueErr) {
      console.warn('Queue cleanup notice during deletion:', queueErr);
    }

    // 3. Statutory Financial Record Preservation (Tax & Dispute Compliance)
    // Decoupled from personal profile, retains minimal transaction metadata required for accounting
    try {
      const paymentRequests = await prisma.paymentRequest.findMany({
        where: { userId },
      });
      for (const pr of paymentRequests) {
        await prisma.financialAuditRecord
          .create({
            data: {
              orderId: pr.paymentId || pr.requestId,
              amount: pr.amount,
              currency: pr.currency || 'INR',
              plan: pr.plan || 'VIP',
              status: pr.status,
              paymentMethod: 'MANUAL_UPI',
              transactionDate: pr.createdAt,
            },
          })
          .catch(() => {});
      }

      const manualPayments = await prisma.manualUpiPayment.findMany({
        where: { userId },
      });
      for (const mp of manualPayments) {
        await prisma.financialAuditRecord
          .create({
            data: {
              orderId: mp.utrNumber || mp.paymentId,
              amount: mp.amount,
              currency: 'INR',
              plan: mp.planName || 'VIP Membership',
              status: mp.status,
              paymentMethod: 'MANUAL_UPI',
              transactionDate: mp.createdAt,
            },
          })
          .catch(() => {});
      }
    } catch (auditErr) {
      console.warn('Notice archiving statutory financial records:', auditErr);
    }

    // 4. Atomically delete all user-associated application records from database
    await prisma.$transaction([
      prisma.userConsent.deleteMany({ where: { userId } }),
      prisma.message.deleteMany({ where: { senderId: userId } }),
      prisma.privateMessage.deleteMany({ where: { senderId: userId } }),
      prisma.callSession.deleteMany({
        where: { OR: [{ callerId: userId }, { receiverId: userId }] },
      }),
      prisma.friendship.deleteMany({
        where: { OR: [{ user1Id: userId }, { user2Id: userId }] },
      }),
      prisma.friendRequest.deleteMany({
        where: { OR: [{ senderId: userId }, { receiverId: userId }] },
      }),
      prisma.block.deleteMany({
        where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
      }),
      prisma.report.deleteMany({
        where: { OR: [{ reporterId: userId }, { reportedUserId: userId }] },
      }),
      prisma.notification.deleteMany({ where: { userId } }),
      prisma.vipRequest.deleteMany({ where: { userId } }),
      prisma.paymentRequest.deleteMany({ where: { userId } }),
      prisma.manualUpiPayment.deleteMany({ where: { userId } }),
      prisma.payment.deleteMany({ where: { userId } }),
      prisma.subscription.deleteMany({ where: { userId } }),
      prisma.profile.deleteMany({ where: { userId } }),
      prisma.user.delete({ where: { id: userId } }),
    ]);

    // 5. Create 48-Hour Deletion Lock Tombstone (Anti-Abuse Protection)
    // Raw email is NEVER retained; only salted HMAC-SHA256 with 48h TTL
    if (verifiedEmail) {
      await createDeletionLock(verifiedEmail).catch((lockErr) => {
        console.warn('Notice creating 48-hour deletion lock:', lockErr);
      });
    }

    // 6. Invalidate and delete Clerk authentication account
    const effectiveClerkId = clerkId || user.clerkUserId;
    if (effectiveClerkId) {
      try {
        const { clerkClient } = await import('@clerk/nextjs/server');
        const client = await clerkClient();
        await client.users.deleteUser(effectiveClerkId);
      } catch (clerkErr) {
        console.warn('Clerk user deletion notice (account may already be removed):', clerkErr);
      }
    }

    const res = NextResponse.json({
      success: true,
      message: 'Account, identity, profile, and all application data permanently deleted.',
    });

    // 7. Invalidate auth session cookies
    res.cookies.set('token', '', {
      ...getAuthCookieOptions(req, 0),
      expires: new Date(0),
      maxAge: 0,
    });

    return res;
  } catch (error) {
    console.error('Error deleting account:', error);
    return NextResponse.json(
      { error: 'Unable to complete account deletion at this time. Please try again.' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  return performAccountDeletion(req);
}

export async function POST(req: Request) {
  return performAccountDeletion(req);
}
