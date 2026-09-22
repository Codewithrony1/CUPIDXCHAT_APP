import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdminAccess } from '@/lib/adminAuth';

export async function POST(req: Request) {
  try {
    const { authorized, user, adminClerkUserId } = await verifyAdminAccess(req);

    if (!authorized) {
      return NextResponse.json({ error: 'Admin authorization required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { userId, action, days = 30, reason } = body;

    if (!userId || !['grant', 'revoke'].includes(action)) {
      return NextResponse.json({ error: 'Valid userId and action ("grant" or "revoke") required.' }, { status: 400 });
    }

    const targetUser = await prisma.user.findFirst({
      where: {
        OR: [{ id: userId }, { clerkUserId: userId }],
      },
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const now = new Date();
    const adminIdentifier = user?.username || adminClerkUserId || user?.id || 'admin';

    if (action === 'grant') {
      const grantDays = parseInt(days.toString(), 10) || 30;
      let baseExpiry = now;
      if (targetUser.is_vip && targetUser.vip_expires_at && new Date(targetUser.vip_expires_at) > now) {
        baseExpiry = new Date(targetUser.vip_expires_at);
      }
      const expiresAt = new Date(baseExpiry.getTime() + grantDays * 24 * 60 * 60 * 1000);

      const updatedUser = await prisma.user.update({
        where: { id: targetUser.id },
        data: {
          membershipTier: 'VIP',
          is_vip: true,
          vip_started_at: targetUser.vip_started_at || now,
          vip_expires_at: expiresAt,
        },
      });

      await prisma.subscription.upsert({
        where: { userId: targetUser.id },
        create: {
          userId: targetUser.id,
          plan: 'VIP',
          isActive: true,
          subscriptionStatus: 'ACTIVE',
          startDate: targetUser.vip_started_at || now,
          endDate: expiresAt,
        },
        update: {
          plan: 'VIP',
          isActive: true,
          subscriptionStatus: 'ACTIVE',
          startDate: targetUser.vip_started_at || now,
          endDate: expiresAt,
        },
      });

      await prisma.notification.create({
        data: {
          userId: targetUser.id,
          type: 'VIP_UPGRADED',
          content: `👑 VIP Granted! Your account was upgraded to VIP by Admin for ${grantDays} days (expires ${expiresAt.toLocaleDateString()}).${reason ? ` Note: ${reason}` : ''}`,
        },
      });

      await prisma.adminLog.create({
        data: {
          adminUserId: user?.id || 'admin',
          adminClerkId: user?.clerkUserId || null,
          action: 'GRANT_VIP',
          targetUserId: targetUser.id,
          entityType: 'SUBSCRIPTION',
          entityId: targetUser.id,
          details: `Admin ${adminIdentifier} manually granted VIP to @${targetUser.username} (${grantDays} days, expires ${expiresAt.toISOString()})${reason ? `. Reason: ${reason}` : ''}`,
        },
      });

      // Sync to Clerk User publicMetadata
      try {
        const targetClerkId = targetUser.clerkUserId || targetUser.id;
        if (targetClerkId) {
          const { clerkClient } = await import('@clerk/nextjs/server');
          const client = await clerkClient();
          await client.users.updateUserMetadata(targetClerkId, {
            publicMetadata: {
              is_vip: true,
              membershipTier: 'VIP',
              vip_expires_at: expiresAt.toISOString(),
            },
          });
        }
      } catch (e) {}

      return NextResponse.json({
        success: true,
        message: `VIP successfully granted to ${targetUser.username} for ${grantDays} days.`,
        user: {
          id: updatedUser.id,
          username: updatedUser.username,
          membershipTier: updatedUser.membershipTier,
          vip_expires_at: updatedUser.vip_expires_at,
        },
      });
    }

    if (action === 'revoke') {
      const updatedUser = await prisma.user.update({
        where: { id: targetUser.id },
        data: {
          membershipTier: 'FREE',
          is_vip: false,
          vip_expires_at: null,
        },
      });

      await prisma.subscription.upsert({
        where: { userId: targetUser.id },
        create: {
          userId: targetUser.id,
          plan: 'FREE',
          isActive: false,
          subscriptionStatus: 'CANCELLED',
        },
        update: {
          plan: 'FREE',
          isActive: false,
          subscriptionStatus: 'CANCELLED',
        },
      });

      await prisma.notification.create({
        data: {
          userId: targetUser.id,
          type: 'VIP_REVOKED',
          content: `⚠️ VIP Status Changed: Your VIP subscription has been revoked by administration.${reason ? ` Reason: ${reason}` : ''}`,
        },
      });

      await prisma.adminLog.create({
        data: {
          adminUserId: user?.id || 'admin',
          adminClerkId: user?.clerkUserId || null,
          action: 'REVOKE_VIP',
          targetUserId: targetUser.id,
          entityType: 'SUBSCRIPTION',
          entityId: targetUser.id,
          details: `Admin ${adminIdentifier} manually revoked VIP from @${targetUser.username}${reason ? `. Reason: ${reason}` : ''}`,
        },
      });

      // Sync to Clerk User publicMetadata
      try {
        const targetClerkId = targetUser.clerkUserId || targetUser.id;
        if (targetClerkId) {
          const { clerkClient } = await import('@clerk/nextjs/server');
          const client = await clerkClient();
          await client.users.updateUserMetadata(targetClerkId, {
            publicMetadata: {
              is_vip: false,
              membershipTier: 'FREE',
              vip_expires_at: null,
            },
          });
        }
      } catch (e) {}

      return NextResponse.json({
        success: true,
        message: `VIP revoked from ${targetUser.username}.`,
        user: {
          id: updatedUser.id,
          username: updatedUser.username,
          membershipTier: updatedUser.membershipTier,
        },
      });
    }
  } catch (error) {
    console.error('Admin plan modification error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
