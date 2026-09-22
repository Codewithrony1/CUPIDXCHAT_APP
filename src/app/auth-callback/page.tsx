import { auth, currentUser as clerkCurrentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function AuthCallbackPage() {
  const session = await auth();
  const userId = session?.userId;

  if (!userId) {
    console.log('[AUTH_CALLBACK] No session userId found -> redirecting to /login');
    redirect('/login');
  }

  // 1. Find existing user in database by clerkUserId or id
  let user = await prisma.user.findFirst({
    where: {
      OR: [
        { clerkUserId: userId },
        { id: userId },
      ],
    },
    include: { profile: true },
  });

  // 2. If not found by clerkUserId, check if verified email matches an existing account and link it
  if (!user) {
    try {
      const cUser = await clerkCurrentUser();
      const email =
        cUser?.primaryEmailAddress?.emailAddress ||
        cUser?.emailAddresses?.[0]?.emailAddress;

      if (email) {
        // Check 48-hour deletion lock
        const { checkDeletionLock } = await import('@/lib/deletionLock');
        const lockStatus = await checkDeletionLock(email);
        if (lockStatus.isLocked) {
          redirect('/login?error=account_deleted_cooldown');
        }

        const existingByEmail = await prisma.user.findFirst({
          where: { email },
          include: { profile: true },
        });

        if (existingByEmail) {
          user = await prisma.user.update({
            where: { id: existingByEmail.id },
            data: { clerkUserId: userId },
            include: { profile: true },
          });
        }
      }
    } catch (e: any) {
      if (e?.digest?.includes('NEXT_REDIRECT') || e?.message?.includes('NEXT_REDIRECT')) {
        throw e;
      }
      console.warn('[AUTH_CALLBACK] Email link check notice:', e?.message || e);
    }
  }

  // 3. Determine if Supabase profile exists and has completed onboarding
  const isProfileComplete = Boolean(
    user &&
    user.username &&
    !user.username.startsWith('user_') &&
    (user.profileCompleted ||
     user.genderDobLocked ||
     user.profile?.profileCompleted ||
     user.profile?.ageGenderConfirmed ||
     (user.dob && user.gender && user.gender !== 'unspecified' && (user.fullName || user.displayName)))
  );

  console.log('[AUTH_CALLBACK] Authoritative post-auth routing:', {
    userIdExists: Boolean(userId),
    userExistsInDb: Boolean(user),
    isProfileComplete,
    destination: isProfileComplete ? '/chat' : '/setup-profile',
  });

  if (isProfileComplete) {
    redirect('/chat');
  } else {
    redirect('/setup-profile');
  }
}
