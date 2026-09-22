import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdminAccess } from '@/lib/adminAuth';
import { deleteStoredImage } from '@/lib/safeImageUpload';

export async function POST(req: Request) {
  try {
    const { authorized, user: admin } = await verifyAdminAccess(req);
    if (!authorized || !admin) return NextResponse.json({ error: 'Admin authorization required' }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const userId = String(body.userId || '').trim();
    if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    const target = await prisma.user.findUnique({ where: { id: userId }, include: { profile: true } });
    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const avatarUrl = target.profile?.avatarUrl || null;
    if (avatarUrl) await deleteStoredImage(avatarUrl);
    await prisma.profile.update({ where: { userId: target.id }, data: { avatarUrl: null, avatarType: 'EMOJI' } });
    try { await prisma.adminLog.create({ data: { adminUserId: admin.id, action: 'DELETE_USER_AVATAR', targetUserId: target.id, entityType: 'USER', entityId: target.id, details: 'Deleted stored avatar for @' + target.username } }); } catch (_) {}
    return NextResponse.json({ success: true, message: 'User profile photo deleted and storage reference cleared.' });
  } catch (error) {
    console.error('Admin avatar deletion error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}