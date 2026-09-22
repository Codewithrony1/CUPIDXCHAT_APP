import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { usernameSchema } from '@/lib/validation/username';
import { validateDob } from '@/lib/validation/dob';
import { MINIMUM_LEGAL_AGE, CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION } from '@/lib/config/policy';
import { signToken, getCurrentUser, getAuthCookieOptions } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const username = searchParams.get('username');

    if (!username) {
      return NextResponse.json(
        { available: false, status: 'invalid', reason: 'Username query parameter is required' },
        { status: 400 }
      );
    }

    const cleanUsername = username.trim().toLowerCase().replace(/^@/, '');

    // Format & reserved username validation
    const validation = usernameSchema.safeParse(cleanUsername);
    if (!validation.success) {
      return NextResponse.json(
        {
          available: false,
          status: 'invalid',
          reason: validation.error.issues[0]?.message || 'Invalid username format',
        },
        { status: 200 }
      );
    }

    // 1. Authoritative Server-Side Identity Resolution
    let currentDbUserId: string | null = null;
    let currentClerkUserId: string | null = null;

    try {
      const u = await getCurrentUser(req);
      if (u) {
        currentDbUserId = u.id;
        if (u.clerkUserId) currentClerkUserId = u.clerkUserId;
      }
    } catch {}

    if (!currentClerkUserId) {
      try {
        const { auth: clerkAuth } = await import('@clerk/nextjs/server');
        const session = await clerkAuth();
        if (session?.userId) {
          currentClerkUserId = session.userId;
        }
      } catch {}
    }

    // Also inspect verified token if clerkAuth did not populate in edge scenarios
    if (!currentClerkUserId) {
      const authHeader = req.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ') && process.env.CLERK_SECRET_KEY) {
        try {
          const { verifyToken: clerkVerifyToken } = await import('@clerk/nextjs/server');
          const rawToken = authHeader.slice(7).trim();
          const verifiedPayload: any = await clerkVerifyToken(rawToken, {
            secretKey: process.env.CLERK_SECRET_KEY,
          });
          const sub = verifiedPayload?.data?.sub || verifiedPayload?.sub;
          if (sub) currentClerkUserId = sub;
        } catch {}
      }
    }

    // If clerkUserId resolved but DB user wasn't yet resolved, find user in DB
    if (currentClerkUserId && !currentDbUserId) {
      try {
        const dbUser = await prisma.user.findFirst({
          where: {
            OR: [
              { clerkUserId: currentClerkUserId },
              { id: currentClerkUserId },
            ],
          },
          select: { id: true, clerkUserId: true },
        });
        if (dbUser) {
          currentDbUserId = dbUser.id;
          currentClerkUserId = dbUser.clerkUserId || currentClerkUserId;
        }
      } catch {}
    }

    // 2. Lookup existing user by username or vipUsername (case-insensitive in PostgreSQL)
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { username: { equals: cleanUsername, mode: 'insensitive' } },
          { vipUsername: { equals: cleanUsername, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        clerkUserId: true,
        username: true,
        vipUsername: true,
      },
    });

    if (existing) {
      // 3. Self-Matching Check: Does this username belong to the requesting user?
      const isSelfMatch = Boolean(
        (currentDbUserId && existing.id === currentDbUserId) ||
        (currentClerkUserId && existing.clerkUserId === currentClerkUserId) ||
        (currentClerkUserId && existing.id === currentClerkUserId)
      );

      if (isSelfMatch) {
        return NextResponse.json({
          available: true,
          selfOwned: true,
          status: 'available',
          message: 'This is your current username',
        });
      }

      // Truly owned by another user
      return NextResponse.json({
        available: false,
        selfOwned: false,
        status: 'taken',
        reason: 'Username is already taken',
      });
    }

    // Completely available
    return NextResponse.json({
      available: true,
      selfOwned: false,
      status: 'available',
    });
  } catch (error: any) {
    console.error('[ONBOARDING] Check username database error:', error);
    // NEVER mask database/server errors as "Username is already taken"
    return NextResponse.json(
      {
        available: false,
        status: 'error',
        error: error?.message || 'Database error',
        code: error?.code,
        reason: 'Unable to verify username availability right now. Please try again.',
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      displayName,
      dob,
      gender,
      avatarEmoji,
      termsAccepted,
      privacyAcknowledged,
      ageConfirmed,
      randomChatAcknowledged,
      locationProcessingAcknowledged,
      marketingConsent,
    } = body;

    // 1. Authoritative Server-Side Identity Check (NEVER trust body.userId)
    let clerkUserId: string | null = null;
    let clerkDetail: any = null;

    try {
      const { auth: clerkAuth, currentUser: clerkCurrentUser } = await import('@clerk/nextjs/server');
      const clerkSession = await clerkAuth();
      if (clerkSession?.userId) {
        clerkUserId = clerkSession.userId;
        clerkDetail = await clerkCurrentUser().catch(() => null);
      }
    } catch (e) {}

    let existingUser = await getCurrentUser(req);
    if (existingUser?.clerkUserId) {
      clerkUserId = existingUser.clerkUserId;
    }

    if (!existingUser && clerkUserId) {
      existingUser = await prisma.user.findFirst({
        where: {
          OR: [
            { clerkUserId },
            { id: clerkUserId },
          ],
        },
        include: { profile: true, subscription: true, consent: true },
      });
    }

    if (!clerkUserId && !existingUser) {
      return NextResponse.json({ error: 'Unauthorized. Please log in first.' }, { status: 401 });
    }

    // 2. Idempotency Check: if profile is already complete, return existing profile safely
    if (
      existingUser &&
      existingUser.profileCompleted &&
      existingUser.username &&
      !existingUser.username.startsWith('user_')
    ) {
      const isVIP =
        existingUser.membershipTier === 'VIP' ||
        (existingUser.subscription?.isActive === true && existingUser.subscription?.plan === 'VIP');

      return NextResponse.json({
        success: true,
        message: 'Profile already onboarded',
        user: {
          id: existingUser.id,
          clerkUserId: existingUser.clerkUserId,
          username: existingUser.username,
          fullName: existingUser.fullName,
          displayName: existingUser.displayName,
          email: existingUser.email,
          role: existingUser.role,
          membershipTier: isVIP ? 'VIP' : 'FREE',
          is_vip: isVIP,
          profileCompleted: true,
          profileLocked: true,
          profile: existingUser.profile,
          subscription: existingUser.subscription,
          consent: (existingUser as any).consent || null,
        },
      });
    }

    // 3. Check 48-Hour Deletion Cooldown Lock
    const checkEmail =
      existingUser?.email ||
      clerkDetail?.primaryEmailAddress?.emailAddress ||
      clerkDetail?.emailAddresses?.[0]?.emailAddress ||
      null;

    if (checkEmail) {
      const { checkDeletionLock } = await import('@/lib/deletionLock');
      const lockStatus = await checkDeletionLock(checkEmail);
      if (lockStatus.isLocked) {
        return NextResponse.json(
          {
            error:
              'Your previous account was recently deleted. For security reasons, you can create a new CupidxChat account after the temporary 48-hour restriction expires.',
            isDeletionLocked: true,
            expiresAt: lockStatus.expiresAt,
            remainingHours: lockStatus.remainingHours,
          },
          { status: 403 }
        );
      }
    }

    // 4. Server-Side Username Validation
    const cleanUsername = (body.username ? String(body.username) : '')
      .trim()
      .toLowerCase()
      .replace(/^@/, '');

    if (!cleanUsername) {
      return NextResponse.json(
        { error: 'Please choose a username.' },
        { status: 400 }
      );
    }

    const usernameValidation = usernameSchema.safeParse(cleanUsername);
    if (!usernameValidation.success) {
      return NextResponse.json(
        { error: usernameValidation.error.issues[0]?.message || 'Username must be 3-20 characters (letters, numbers, and underscores).' },
        { status: 400 }
      );
    }

    // Check collision against other users (case-insensitive in PostgreSQL, checking both username and vipUsername)
    const usernameConflict = await prisma.user.findFirst({
      where: {
        OR: [
          { username: { equals: cleanUsername, mode: 'insensitive' } },
          { vipUsername: { equals: cleanUsername, mode: 'insensitive' } },
        ],
        NOT: [
          ...(existingUser?.id ? [{ id: existingUser.id }] : []),
          ...(existingUser?.clerkUserId ? [{ clerkUserId: existingUser.clerkUserId }] : []),
          ...(clerkUserId ? [{ clerkUserId }, { id: clerkUserId }] : []),
        ],
      },
    });

    if (usernameConflict) {
      return NextResponse.json(
        { error: 'Username is already taken. Please choose another username.' },
        { status: 400 }
      );
    }

    // 5. Full Name Validation
    const cleanDisplayName = (displayName || clerkDetail?.fullName || cleanUsername).trim();
    if (cleanDisplayName.length < 2 || cleanDisplayName.length > 50) {
      return NextResponse.json(
        { error: 'Please enter a valid full name (2 to 50 characters).' },
        { status: 400 }
      );
    }

    // 6. Server-Side Consent Validation
    if (!termsAccepted) {
      return NextResponse.json(
        { error: 'You must review and agree to the Terms & Conditions.' },
        { status: 400 }
      );
    }
    if (!privacyAcknowledged) {
      return NextResponse.json(
        { error: 'You must acknowledge that you have read and understood the Privacy Policy.' },
        { status: 400 }
      );
    }
    if (!ageConfirmed) {
      return NextResponse.json(
        { error: `You must confirm that you meet the minimum age requirement (${MINIMUM_LEGAL_AGE}+) to use CupidX.` },
        { status: 400 }
      );
    }
    if (!randomChatAcknowledged) {
      return NextResponse.json(
        { error: 'You must acknowledge that CupidX connects you with strangers for random chat.' },
        { status: 400 }
      );
    }
    if (!locationProcessingAcknowledged) {
      return NextResponse.json(
        { error: 'You must acknowledge technical processing of approximate country information as described in the Privacy Policy.' },
        { status: 400 }
      );
    }

    // 7. Server-Side DOB & 18+ Age Validation
    const dobValidation = validateDob(dob);
    if (!dobValidation.valid) {
      return NextResponse.json(
        { error: dobValidation.error || 'Please enter a valid date of birth.' },
        { status: 400 }
      );
    }

    const parsedDob = dobValidation.dob!;
    const calculatedAge = dobValidation.age!;

    if (calculatedAge < MINIMUM_LEGAL_AGE) {
      return NextResponse.json(
        { error: `You must be at least ${MINIMUM_LEGAL_AGE} years old to use CupidX.` },
        { status: 400 }
      );
    }

    const validGenders = ['male', 'female', 'other', 'prefer_not_to_say'];
    const cleanGender = gender && validGenders.includes(gender.toString().trim().toLowerCase())
      ? gender.toString().trim().toLowerCase()
      : 'male';

    const selectedEmoji = avatarEmoji || '😊';
    const consentNow = new Date();

    const ADMIN_EMAILS = [
      'lexinoofficial@gmail.com',
      'admin@cupidxchat.in',
      process.env.ADMIN_EMAIL,
    ].filter(Boolean).map((e) => e!.toLowerCase().trim());
    const isAutoAdmin = Boolean(checkEmail && ADMIN_EMAILS.includes(checkEmail.toLowerCase().trim()));

    // 8. Atomic Database Creation or Update
    let updatedUser: any;
    try {
      if (existingUser) {
        // User already has an existing DB row (e.g. from previous email match or uncompleted session)
        const [u] = await prisma.$transaction([
          prisma.user.update({
            where: { id: existingUser.id },
            data: {
              ...(clerkUserId ? { clerkUserId } : {}),
              username: cleanUsername,
              fullName: cleanDisplayName,
              displayName: cleanDisplayName,
              gender: cleanGender,
              dob: parsedDob,
              genderDobLocked: true,
              profileCompleted: true,
              profileLocked: true,
              ...(isAutoAdmin ? { role: 'ADMIN' } : {}),
            },
            include: { profile: true, subscription: true, consent: true },
          }),
          prisma.profile.upsert({
            where: { userId: existingUser.id },
            update: {
              avatarType: 'EMOJI',
              avatarEmoji: selectedEmoji,
              age: calculatedAge,
              gender: cleanGender,
              dob: parsedDob,
              ageGenderConfirmed: true,
              profileCompleted: true,
              profileLocked: true,
            },
            create: {
              userId: existingUser.id,
              avatarType: 'EMOJI',
              avatarEmoji: selectedEmoji,
              age: calculatedAge,
              gender: cleanGender,
              dob: parsedDob,
              ageGenderConfirmed: true,
              profileCompleted: true,
              profileLocked: true,
              bio: 'Hey there! I am using CupidX.',
            },
          }),
          prisma.userConsent.upsert({
            where: { userId: existingUser.id },
            update: {
              termsAccepted: true,
              termsAcceptedAt: consentNow,
              privacyAcknowledged: true,
              privacyAcknowledgedAt: consentNow,
              ageConfirmed: true,
              ageConfirmedAt: consentNow,
              randomChatAcknowledged: true,
              randomChatAcknowledgedAt: consentNow,
              locationProcessingAcknowledged: true,
              locationProcessingAcknowledgedAt: consentNow,
              marketingConsent: Boolean(marketingConsent),
              marketingConsentUpdatedAt: marketingConsent ? consentNow : null,
              termsVersion: CURRENT_TERMS_VERSION,
              privacyVersion: CURRENT_PRIVACY_VERSION,
              consentTimestamp: consentNow,
            },
            create: {
              userId: existingUser.id,
              termsAccepted: true,
              termsAcceptedAt: consentNow,
              privacyAcknowledged: true,
              privacyAcknowledgedAt: consentNow,
              ageConfirmed: true,
              ageConfirmedAt: consentNow,
              randomChatAcknowledged: true,
              randomChatAcknowledgedAt: consentNow,
              locationProcessingAcknowledged: true,
              locationProcessingAcknowledgedAt: consentNow,
              marketingConsent: Boolean(marketingConsent),
              marketingConsentUpdatedAt: marketingConsent ? consentNow : null,
              termsVersion: CURRENT_TERMS_VERSION,
              privacyVersion: CURRENT_PRIVACY_VERSION,
              consentTimestamp: consentNow,
            },
          }),
        ]);
        updatedUser = u;
      } else {
        // Brand new user: link to Clerk userId as identity reference
        const finalClerkId = clerkUserId!;

        // Check if an unlinked user already exists with this email address
        if (checkEmail) {
          const matchedByEmail = await prisma.user.findFirst({
            where: { email: checkEmail },
          });
          if (matchedByEmail) {
            const [u] = await prisma.$transaction([
              prisma.user.update({
                where: { id: matchedByEmail.id },
                data: {
                  clerkUserId: finalClerkId,
                  username: cleanUsername,
                  fullName: cleanDisplayName,
                  displayName: cleanDisplayName,
                  gender: cleanGender,
                  dob: parsedDob,
                  genderDobLocked: true,
                  profileCompleted: true,
                  profileLocked: true,
                  ...(isAutoAdmin ? { role: 'ADMIN' } : {}),
                },
                include: { profile: true, subscription: true, consent: true },
              }),
              prisma.profile.upsert({
                where: { userId: matchedByEmail.id },
                update: {
                  avatarType: 'EMOJI',
                  avatarEmoji: selectedEmoji,
                  age: calculatedAge,
                  gender: cleanGender,
                  dob: parsedDob,
                  ageGenderConfirmed: true,
                  profileCompleted: true,
                  profileLocked: true,
                },
                create: {
                  userId: matchedByEmail.id,
                  avatarType: 'EMOJI',
                  avatarEmoji: selectedEmoji,
                  age: calculatedAge,
                  gender: cleanGender,
                  dob: parsedDob,
                  ageGenderConfirmed: true,
                  profileCompleted: true,
                  profileLocked: true,
                  bio: 'Hey there! I am using CupidX.',
                },
              }),
              prisma.userConsent.upsert({
                where: { userId: matchedByEmail.id },
                update: {
                  termsAccepted: true,
                  termsAcceptedAt: consentNow,
                  privacyAcknowledged: true,
                  privacyAcknowledgedAt: consentNow,
                  ageConfirmed: true,
                  ageConfirmedAt: consentNow,
                  randomChatAcknowledged: true,
                  randomChatAcknowledgedAt: consentNow,
                  locationProcessingAcknowledged: true,
                  locationProcessingAcknowledgedAt: consentNow,
                  marketingConsent: Boolean(marketingConsent),
                  termsVersion: CURRENT_TERMS_VERSION,
                  privacyVersion: CURRENT_PRIVACY_VERSION,
                  consentTimestamp: consentNow,
                },
                create: {
                  userId: matchedByEmail.id,
                  termsAccepted: true,
                  termsAcceptedAt: consentNow,
                  privacyAcknowledged: true,
                  privacyAcknowledgedAt: consentNow,
                  ageConfirmed: true,
                  ageConfirmedAt: consentNow,
                  randomChatAcknowledged: true,
                  randomChatAcknowledgedAt: consentNow,
                  locationProcessingAcknowledged: true,
                  locationProcessingAcknowledgedAt: consentNow,
                  marketingConsent: Boolean(marketingConsent),
                  termsVersion: CURRENT_TERMS_VERSION,
                  privacyVersion: CURRENT_PRIVACY_VERSION,
                  consentTimestamp: consentNow,
                },
              }),
            ]);
            updatedUser = u;
          }
        }

        if (!updatedUser) {
          // Pure new user creation with nested profile and consent
          updatedUser = await prisma.user.create({
            data: {
              id: finalClerkId,
              clerkUserId: finalClerkId,
              username: cleanUsername,
              fullName: cleanDisplayName,
              displayName: cleanDisplayName,
              email: checkEmail,
              role: isAutoAdmin ? 'ADMIN' : 'USER',
              membershipTier: 'FREE',
              is_vip: false,
              dob: parsedDob,
              gender: cleanGender,
              genderDobLocked: true,
              profileCompleted: true,
              profileLocked: true,
              profile: {
                create: {
                  avatarType: 'EMOJI',
                  avatarEmoji: selectedEmoji,
                  age: calculatedAge,
                  gender: cleanGender,
                  dob: parsedDob,
                  ageGenderConfirmed: true,
                  profileCompleted: true,
                  profileLocked: true,
                  bio: 'Hey there! I am using CupidX.',
                },
              },
              consent: {
                create: {
                  termsAccepted: true,
                  termsAcceptedAt: consentNow,
                  privacyAcknowledged: true,
                  privacyAcknowledgedAt: consentNow,
                  ageConfirmed: true,
                  ageConfirmedAt: consentNow,
                  randomChatAcknowledged: true,
                  randomChatAcknowledgedAt: consentNow,
                  locationProcessingAcknowledged: true,
                  locationProcessingAcknowledgedAt: consentNow,
                  marketingConsent: Boolean(marketingConsent),
                  marketingConsentUpdatedAt: marketingConsent ? consentNow : null,
                  termsVersion: CURRENT_TERMS_VERSION,
                  privacyVersion: CURRENT_PRIVACY_VERSION,
                  consentTimestamp: consentNow,
                },
              },
            },
            include: { profile: true, subscription: true, consent: true },
          });
        }
      }
    } catch (dbErr: any) {
      // 9. Handle Database Uniqueness Race Conditions (Prisma P2002)
      if (dbErr?.code === 'P2002') {
        const target = dbErr?.meta?.target;
        const targetStr = Array.isArray(target) ? target.join(',') : String(target || '');

        if (targetStr.toLowerCase().includes('username')) {
          // Verify if conflict was caused by a concurrent self-retry
          const conflictOwner = await prisma.user.findFirst({
            where: {
              OR: [
                { username: { equals: cleanUsername, mode: 'insensitive' } },
                { vipUsername: { equals: cleanUsername, mode: 'insensitive' } },
              ],
            },
            include: { profile: true, subscription: true, consent: true },
          });

          const isSelf = conflictOwner && (
            conflictOwner.id === existingUser?.id ||
            conflictOwner.clerkUserId === clerkUserId ||
            conflictOwner.id === clerkUserId
          );

          if (isSelf) {
            updatedUser = conflictOwner;
          } else {
            return NextResponse.json(
              { error: 'Username is already taken. Please choose another username.' },
              { status: 400 }
            );
          }
        }

        // Concurrent duplicate submission on clerkUserId or primary key: return existing user idempotently
        if (!updatedUser && (targetStr.includes('clerkUserId') || targetStr.includes('id') || targetStr.includes('pkey')) && clerkUserId) {
          const existing = await prisma.user.findFirst({
            where: {
              OR: [
                { clerkUserId },
                { id: clerkUserId },
              ],
            },
            include: { profile: true, subscription: true, consent: true },
          });
          if (existing) {
            updatedUser = existing;
          }
        }
      }

      if (!updatedUser) {
        console.error('[ONBOARDING] Database error:', dbErr);
        return NextResponse.json(
          { error: 'Failed to create profile. Please try again.' },
          { status: 500 }
        );
      }
    }

    const isVIP =
      updatedUser.membershipTier === 'VIP' ||
      (updatedUser.subscription?.isActive === true && updatedUser.subscription?.plan === 'VIP');

    // 10. Sync to Clerk User publicMetadata & username
    try {
      const targetClerkId = updatedUser.clerkUserId || clerkUserId;
      if (targetClerkId) {
        const { clerkClient } = await import('@clerk/nextjs/server');
        const client = await clerkClient();
        await client.users.updateUserMetadata(targetClerkId, {
          publicMetadata: {
            profileCompleted: true,
            profileLocked: true,
            genderDobLocked: true,
            dob: parsedDob.toISOString().slice(0, 10),
            gender: cleanGender,
            fullName: cleanDisplayName,
            displayName: cleanDisplayName,
            avatarEmoji: selectedEmoji,
            termsVersion: CURRENT_TERMS_VERSION,
            privacyVersion: CURRENT_PRIVACY_VERSION,
          },
        });

        if (cleanUsername) {
          await client.users.updateUser(targetClerkId, {
            username: cleanUsername,
          }).catch((uErr: any) => {
            console.warn('[ONBOARDING] Clerk username update notice:', uErr?.message || uErr);
          });
        }
      }
    } catch (clerkSyncErr) {
      console.warn('[ONBOARDING] Clerk metadata sync notice:', clerkSyncErr);
    }

    const token = signToken({
      userId: updatedUser.id,
      username: updatedUser.username,
      role: updatedUser.role,
    });

    const response = NextResponse.json({
      success: true,
      message: 'Profile onboarded successfully',
      user: {
        id: updatedUser.id,
        clerkUserId: updatedUser.clerkUserId,
        username: updatedUser.username,
        fullName: updatedUser.fullName,
        displayName: updatedUser.displayName,
        email: updatedUser.email,
        role: updatedUser.role,
        membershipTier: isVIP ? 'VIP' : 'FREE',
        is_vip: isVIP,
        profileCompleted: true,
        profileLocked: true,
        profile: updatedUser.profile,
        subscription: updatedUser.subscription,
        consent: updatedUser.consent,
      },
    });

    response.cookies.set('token', token, getAuthCookieOptions(req, 30 * 24 * 60 * 60));
    return response;
  } catch (error: any) {
    console.error('Onboarding save error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to complete profile setup. Please try again.' },
      { status: 500 }
    );
  }
}
