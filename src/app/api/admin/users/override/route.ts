import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdminAccess } from '@/lib/adminAuth';

export async function POST(req: Request) {
  try {
    const { authorized, user: admin } = await verifyAdminAccess(req);

    if (!authorized) {
      return NextResponse.json({ error: 'Admin authorization required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { userId, gender, dob, genderDobLocked, is_vip, isSuspended } = body;

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const parsedDob = dob ? new Date(dob) : undefined;
    const cleanGender = gender ? gender.toString().trim().toLowerCase() : undefined;

    const updateData: any = {};
    if (cleanGender !== undefined) updateData.gender = cleanGender;
    if (parsedDob && !isNaN(parsedDob.getTime())) updateData.dob = parsedDob;
    if (genderDobLocked !== undefined) updateData.genderDobLocked = Boolean(genderDobLocked);
    if (isSuspended !== undefined) updateData.isSuspended = Boolean(isSuspended);

    if (is_vip !== undefined) {
      const vipBool = Boolean(is_vip);
      updateData.is_vip = vipBool;
      updateData.membershipTier = vipBool ? 'VIP' : 'FREE';
      if (vipBool && (!targetUser.vip_expires_at || new Date(targetUser.vip_expires_at) <= new Date())) {
        updateData.vip_expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      } else if (!vipBool) {
        updateData.vip_expires_at = null;
      }
    }

    // Update User record safely
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    // Mirror gender update to Profile record if exists
    if (cleanGender) {
      await prisma.profile.upsert({
        where: { userId },
        update: {
          gender: cleanGender,
          ageGenderConfirmed: true,
        },
        create: {
          userId,
          gender: cleanGender,
          ageGenderConfirmed: true,
          bio: '',
          interests: '',
          themePreference: 'dark',
        },
      });
    }

    // Log admin action in AdminLog
    await prisma.adminLog.create({
      data: {
        adminUserId: admin?.id || 'admin',
        adminClerkId: admin?.clerkUserId || null,
        action: 'OVERRIDE_USER_ATTRIBUTES',
        targetUserId: userId,
        entityType: 'USER',
        entityId: userId,
        details: `Updated attributes for user @${targetUser.username}: ${JSON.stringify(updateData)}`,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'User attributes updated successfully.',
      user: updatedUser,
    });
  } catch (error) {
    console.error('Error updating user override attributes:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
