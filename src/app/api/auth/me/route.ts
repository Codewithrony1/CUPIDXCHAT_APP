import { NextResponse } from 'next/server';
import { getCurrentUser, signToken, getAuthCookieOptions } from '@/lib/auth';
import { isUserVip } from '@/lib/vipAuth';

export async function GET(req: Request) {
  try {
    let user: any = await getCurrentUser(req);
    let clerkUserId: string | null = null;
    let clerkDetail: any = null;

    if (!user) {
      try {
        const { auth: clerkAuth, currentUser: clerkCurrentUser } = await import('@clerk/nextjs/server');
        const clerkSession = await clerkAuth();
        if (clerkSession?.userId) {
          clerkUserId = clerkSession.userId;
          clerkDetail = await clerkCurrentUser().catch(() => null);
        }
      } catch (e) {}
    } else if (user.clerkUserId) {
      clerkUserId = user.clerkUserId;
    }

    if (user) {
      const ADMIN_EMAILS = [
        'lexinoofficial@gmail.com',
        'admin@cupidxchat.in',
        process.env.ADMIN_EMAIL,
      ].filter(Boolean).map((e) => e!.toLowerCase().trim());
      if (user.email && ADMIN_EMAILS.includes(user.email.toLowerCase().trim())) {
        user.role = 'ADMIN';
      }

      const isVIP = isUserVip(user);
      const isProfileDone = Boolean(
        user.username &&
        !user.username.startsWith('user_') &&
        (user.profileCompleted ||
         user.profileLocked ||
         user.genderDobLocked ||
         user.profile?.profileCompleted ||
         user.profile?.ageGenderConfirmed ||
         (user.dob && user.gender && user.gender !== 'unspecified' && user.fullName))
      );

      console.log('[AUTH_FLOW] /api/auth/me:', {
        userIdExists: Boolean(user.id),
        clerkUserIdExists: Boolean(user.clerkUserId),
        profileExists: Boolean(user.profile),
        onboardingCompleted: isProfileDone,
        routingTarget: isProfileDone ? '/chat' : '/setup-profile',
      });

      const token = signToken({
        userId: user.id,
        username: user.username,
        role: user.role,
      });

      const response = NextResponse.json({
        authenticated: true,
        clerkUserId: user.clerkUserId,
        profileCompleted: isProfileDone,
        user: {
          id: user.id,
          clerkUserId: user.clerkUserId,
          username: user.username,
          vipUsername: user.vipUsername || null,
          vipUsernameClaimedAt: user.vipUsernameClaimedAt || null,
          fullName: user.fullName,
          displayName: user.displayName || user.fullName,
          email: user.email,
          gender: user.gender || user.profile?.gender || 'unspecified',
          dob: user.dob ? new Date(user.dob).toISOString().slice(0, 10) : (user.profile?.dob ? new Date(user.profile.dob).toISOString().slice(0, 10) : null),
          genderDobLocked: Boolean(user.genderDobLocked || user.profile?.ageGenderConfirmed),
          role: user.role,
          membershipTier: isVIP ? 'VIP' : 'FREE',
          is_vip: isVIP,
          vip_started_at: user.vip_started_at || user.subscription?.startDate || null,
          vip_expires_at: user.vip_expires_at || user.subscription?.endDate || null,
          profileCompleted: isProfileDone,
          profileLocked: isProfileDone,
          profile: user.profile,
          subscription: user.subscription,
        },
      });

      response.cookies.set('token', token, getAuthCookieOptions(req, 30 * 24 * 60 * 60));
      return response;
    }

    // Authenticated with Clerk, but no Supabase profile created yet
    if (clerkUserId) {
      const email =
        clerkDetail?.primaryEmailAddress?.emailAddress ||
        clerkDetail?.emailAddresses?.[0]?.emailAddress ||
        null;
      const displayName =
        clerkDetail?.fullName ||
        (clerkDetail?.firstName ? `${clerkDetail.firstName} ${clerkDetail.lastName || ''}`.trim() : null) ||
        clerkDetail?.username ||
        'User';

      return NextResponse.json({
        authenticated: true,
        clerkUserId,
        user: null,
        profileCompleted: false,
        suggestedEmail: email,
        suggestedDisplayName: displayName,
        suggestedUsername: clerkDetail?.username || (email ? email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20) : ''),
      });
    }

    return NextResponse.json({ error: 'Unauthorized', authenticated: false }, { status: 401 });
  } catch (error) {
    console.error('Error in /api/auth/me:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
