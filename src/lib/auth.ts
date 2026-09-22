import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from './prisma';
import { auth as clerkAuth, currentUser as clerkCurrentUser, clerkClient, verifyToken as clerkVerifyToken } from '@clerk/nextjs/server';

const JWT_SECRET = process.env.JWT_SECRET?.trim() || null;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export interface TokenPayload {
  userId: string;
  username: string;
  role: string;
  countryCode?: string;
  countryName?: string;
  countryFlag?: string;
}

export function signToken(payload: TokenPayload): string {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is required for legacy local authentication.');
  }
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
}

export function verifyToken(token: string): TokenPayload | null {
  if (!JWT_SECRET) return null;
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch (e) {
    return null;
  }
}

/**
 * Retrieve an existing user or safely provision a new user from Clerk.
 */
export async function getOrCreateUserFromClerk(clerkId: string) {
  if (!clerkId || typeof clerkId !== 'string') return null;
  const cleanId = clerkId.trim();
  if (!cleanId) return null;

  // 1. Check if user exists in database by clerkUserId or id
  let user = await prisma.user.findFirst({
    where: {
      OR: [
        { clerkUserId: cleanId },
        { id: cleanId },
      ],
    },
    include: {
      profile: true,
      subscription: true,
    },
  });

  if (user) {
    const ADMIN_EMAILS = [
      'lexinoofficial@gmail.com',
      'admin@cupidxchat.in',
      process.env.ADMIN_EMAIL,
    ].filter(Boolean).map((e) => e!.toLowerCase().trim());
    if (user.email && ADMIN_EMAILS.includes(user.email.toLowerCase().trim()) && user.role !== 'ADMIN') {
      try {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { role: 'ADMIN' },
          include: { profile: true, subscription: true },
        });
      } catch (e) {}
    }

    if (!user.clerkUserId) {
      await prisma.user.update({
        where: { id: user.id },
        data: { clerkUserId: cleanId },
      });
      user.clerkUserId = cleanId;
    }

    // Self-healing check: if profile is not marked completed in Prisma, verify Clerk metadata
    if (!user.profileCompleted || !user.genderDobLocked || user.gender === 'unspecified' || !user.dob) {
      let isCompletedInCloud = false;
      let cloudDob: Date | null = null;
      let cloudGender: string = 'unspecified';
      let cloudName: string | null = null;
      let cloudAvatarEmoji: string = '😊';
      let isCloudVip = false;

      // Check Clerk User publicMetadata
      try {
        const client = await clerkClient();
        const cDetail = await client.users.getUser(cleanId);
        const meta: any = cDetail?.publicMetadata || {};
        if (meta?.profileCompleted || meta?.genderDobLocked || (meta?.dob && meta?.gender && meta?.gender !== 'unspecified')) {
          isCompletedInCloud = true;
          if (meta?.dob && !cloudDob) cloudDob = new Date(meta.dob);
          if (meta?.gender && cloudGender === 'unspecified') cloudGender = meta.gender;
          if ((meta?.displayName || meta?.fullName) && !cloudName) cloudName = meta.displayName || meta.fullName;
          if (meta?.avatarEmoji) cloudAvatarEmoji = meta.avatarEmoji;
        }
        if (meta?.is_vip || meta?.membershipTier === 'VIP') {
          isCloudVip = true;
        }
      } catch (clerkErr) {}

      if (isCompletedInCloud) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            profileCompleted: true,
            profileLocked: true,
            genderDobLocked: true,
            ...(isCloudVip ? { is_vip: true, membershipTier: 'VIP' } : {}),
            ...(cloudName ? { fullName: cloudName, displayName: cloudName } : {}),
            ...(cloudDob ? { dob: cloudDob } : {}),
            ...(cloudGender !== 'unspecified' ? { gender: cloudGender } : {}),
            profile: {
              upsert: {
                update: {
                  profileCompleted: true,
                  profileLocked: true,
                  ageGenderConfirmed: true,
                  avatarEmoji: cloudAvatarEmoji,
                  ...(cloudDob ? { dob: cloudDob } : {}),
                  ...(cloudGender !== 'unspecified' ? { gender: cloudGender } : {}),
                },
                create: {
                  profileCompleted: true,
                  profileLocked: true,
                  ageGenderConfirmed: true,
                  avatarEmoji: cloudAvatarEmoji,
                  bio: 'Hey there! I am using CupidX.',
                  ...(cloudDob ? { dob: cloudDob } : {}),
                  ...(cloudGender !== 'unspecified' ? { gender: cloudGender } : {}),
                },
              },
            },
          },
          include: { profile: true, subscription: true },
        });
      }
    }

    return user;
  }

  // 2. Fetch authoritative Clerk user details
  let clerkDetail: any = null;
  try {
    const client = await clerkClient();
    clerkDetail = await client.users.getUser(cleanId);
  } catch (err) {
    try {
      clerkDetail = await clerkCurrentUser();
    } catch (e) {}
  }

  const email =
    clerkDetail?.primaryEmailAddress?.emailAddress ||
    clerkDetail?.emailAddresses?.[0]?.emailAddress ||
    null;

  // Check 48-Hour Deletion Cooldown Lock (Anti-abuse protection)
  if (email) {
    const { checkDeletionLock } = await import('@/lib/deletionLock');
    const lockStatus = await checkDeletionLock(email);
    if (lockStatus.isLocked) {
      const err: any = new Error(
        'Your previous account was recently deleted. For security reasons, you can create a new CupidxChat account after the temporary 48-hour restriction expires.'
      );
      err.isDeletionLocked = true;
      err.expiresAt = lockStatus.expiresAt;
      err.remainingHours = lockStatus.remainingHours;
      throw err;
    }
  }

  // Check if account already exists with this email address
  if (email) {
    const existingByEmail = await prisma.user.findFirst({
      where: { email },
      include: { profile: true, subscription: true },
    });

    if (existingByEmail) {
      const ADMIN_EMAILS = [
        'lexinoofficial@gmail.com',
        'admin@cupidxchat.in',
        process.env.ADMIN_EMAIL,
      ].filter(Boolean).map((e) => e!.toLowerCase().trim());
      const isAutoAdmin = email && ADMIN_EMAILS.includes(email.toLowerCase().trim());

      user = await prisma.user.update({
        where: { id: existingByEmail.id },
        data: {
          clerkUserId: cleanId,
          ...(isAutoAdmin && existingByEmail.role !== 'ADMIN' ? { role: 'ADMIN' } : {}),
        },
        include: { profile: true, subscription: true },
      });
      return user;
    }
  }

  // 3. Provision new user in database with collision-free username
  let isCloudCompleted = false;
  let cloudDob: Date | null = null;
  let cloudGender: string = 'unspecified';
  let cloudName: string | null = null;
  let cloudAvatarEmoji: string = '😊';
  let isCloudVip = false;

  const meta: any = clerkDetail?.publicMetadata || {};
  if (meta?.profileCompleted || meta?.genderDobLocked || (meta?.dob && meta?.gender && meta?.gender !== 'unspecified')) {
    isCloudCompleted = true;
    if (meta?.dob && !cloudDob) cloudDob = new Date(meta.dob);
    if (meta?.gender && cloudGender === 'unspecified') cloudGender = meta.gender;
    if ((meta?.displayName || meta?.fullName) && !cloudName) cloudName = meta.displayName || meta.fullName;
    if (meta?.avatarEmoji) cloudAvatarEmoji = meta.avatarEmoji;
  }
  if (meta?.is_vip || meta?.membershipTier === 'VIP') {
    isCloudVip = true;
  }

  const rawName =
    cloudName ||
    clerkDetail?.fullName ||
    (clerkDetail?.firstName ? `${clerkDetail.firstName} ${clerkDetail.lastName || ''}`.trim() : null) ||
    clerkDetail?.username ||
    'CupidX User';

  const baseUsername =
    (clerkDetail?.username || (email ? email.split('@')[0] : `user_${cleanId.slice(-5)}`))
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '') || `user_${cleanId.slice(-5)}`;

  const randomSuffix = Math.random().toString(36).substring(2, 6);
  const timeSuffix = Date.now().toString().slice(-4);
  const cleanUsername = `${baseUsername.slice(0, 12)}_${randomSuffix}${timeSuffix}`;

  const ADMIN_EMAILS = [
    'lexinoofficial@gmail.com',
    'admin@cupidxchat.in',
    process.env.ADMIN_EMAIL,
  ].filter(Boolean).map((e) => e!.toLowerCase().trim());
  const isAutoAdmin = Boolean(email && ADMIN_EMAILS.includes(email.toLowerCase().trim()));

  try {
    user = await prisma.user.create({
      data: {
        id: cleanId,
        clerkUserId: cleanId,
        username: cleanUsername,
        fullName: rawName,
        displayName: rawName,
        email,
        role: isAutoAdmin ? 'ADMIN' : 'USER',
        membershipTier: isCloudVip ? 'VIP' : 'FREE',
        is_vip: isCloudVip,
        dob: cloudDob,
        gender: cloudGender,
        profileCompleted: isCloudCompleted,
        profileLocked: isCloudCompleted,
        genderDobLocked: isCloudCompleted,
        profile: {
          create: {
            age: 18,
            gender: cloudGender,
            dob: cloudDob,
            bio: 'Hey there! I am using CupidX.',
            avatarEmoji: cloudAvatarEmoji,
            avatarType: 'EMOJI',
            profileCompleted: isCloudCompleted,
            profileLocked: isCloudCompleted,
            ageGenderConfirmed: isCloudCompleted,
          },
        },
      },
      include: {
        profile: true,
        subscription: true,
      },
    });
  } catch (createErr) {
    // In case of parallel race, look up existing
    user = await prisma.user.findFirst({
      where: {
        OR: [{ clerkUserId: cleanId }, { id: cleanId }],
      },
      include: {
        profile: true,
        subscription: true,
      },
    });
  }

  console.log('[AUTH:PROVISION] User provisioned/resolved:', {
    clerkUserIdExists: Boolean(cleanId),
    usernameExists: Boolean(user?.username),
    profileExists: Boolean(user?.profile),
    onboardingCompleted: Boolean(user?.profileCompleted),
  });

  return user;
}

export async function getCurrentUser(req?: Request) {
  try {
    let resolvedClerkId: string | null = null;

    // 1. Authoritative Clerk session check (via clerkMiddleware and App Router auth)
    try {
      const clerkData = await clerkAuth();
      if (clerkData && clerkData.userId) {
        resolvedClerkId = clerkData.userId;
      }
    } catch (clerkErr) {
      // clerkAuth may throw outside Next.js request lifecycle
    }

    // 2. Direct Clerk currentUser() check as additional fallback
    if (!resolvedClerkId) {
      try {
        const clerkUser = await clerkCurrentUser();
        if (clerkUser && clerkUser.id) {
          resolvedClerkId = clerkUser.id;
        }
      } catch (e) {}
    }

    // 3. Cryptographically verify Bearer token from Authorization header
    if (!resolvedClerkId && req) {
      const authHeader = req.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const rawToken = authHeader.slice(7).trim();
        // A. Check local signed JWT
        const localPayload = verifyToken(rawToken);
        if (localPayload?.userId) {
          const user = await prisma.user.findUnique({
            where: { id: localPayload.userId },
            include: { profile: true, subscription: true },
          });
          if (user && !user.isSuspended) return user;
        }

        // B. Cryptographically verify Clerk JWT
        if (process.env.CLERK_SECRET_KEY) {
          try {
            const verifiedPayload: any = await clerkVerifyToken(rawToken, {
              secretKey: process.env.CLERK_SECRET_KEY,
            });
            const sub = verifiedPayload?.data?.sub || verifiedPayload?.sub;
            if (sub) {
              resolvedClerkId = sub;
            }
          } catch (e) {
            // Invalid or expired token
          }
        }
      }
    }

    // 4. Cryptographically verify Clerk __session cookie
    if (!resolvedClerkId && req) {
      const cookieHeader = req.headers.get('cookie') || '';
      const sessionMatch = cookieHeader.match(/(?:^|;\s*)__session=([^;]*)/);
      if (sessionMatch && sessionMatch[1] && process.env.CLERK_SECRET_KEY) {
        try {
          const verifiedPayload: any = await clerkVerifyToken(sessionMatch[1], {
            secretKey: process.env.CLERK_SECRET_KEY,
          });
          const sub = verifiedPayload?.data?.sub || verifiedPayload?.sub;
          if (sub) {
            resolvedClerkId = sub;
          }
        } catch (e) {
          // Invalid or expired cookie
        }
      }
    }

    // 5. If Clerk user ID was cryptographically verified, resolve existing user from Supabase/Prisma
    if (resolvedClerkId) {
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { clerkUserId: resolvedClerkId },
            { id: resolvedClerkId },
          ],
        },
        include: {
          profile: true,
          subscription: true,
        },
      });

      if (user && !user.isSuspended) {
        // Auto-expire VIP/Premium if expired
        if (user.is_vip && user.vip_expires_at && new Date(user.vip_expires_at).getTime() <= Date.now()) {
          await prisma.user.update({
            where: { id: user.id },
            data: { is_vip: false, membershipTier: 'FREE' },
          });
          user.is_vip = false;
          user.membershipTier = 'FREE';
        }
        return user;
      }
    }

    // 5. Check local signed JWT cookie token
    if (req) {
      const cookieHeader = req.headers.get('cookie') || '';
      const cookieMatch = cookieHeader.match(/(?:^|;\s*)token=([^;]*)/);
      const token = cookieMatch ? cookieMatch[1] : null;

      if (token) {
        const payload = verifyToken(token);
        if (payload && payload.userId) {
          const user = await prisma.user.findUnique({
            where: { id: payload.userId },
            include: {
              profile: true,
              subscription: true,
            },
          });

          if (user && !user.isSuspended) {
            if (user.is_vip && user.vip_expires_at && new Date(user.vip_expires_at).getTime() <= Date.now()) {
              await prisma.user.update({
                where: { id: user.id },
                data: { is_vip: false, membershipTier: 'FREE' },
              });
              user.is_vip = false;
              user.membershipTier = 'FREE';
            }
            return user;
          }
        }
      }
    }

    return null;
  } catch (error) {
    console.error('getCurrentUser error:', error);
    return null;
  }
}

/**
 * Hardened session cookie configuration options (BUG-004)
 * Guarantees HttpOnly: true, SameSite: 'strict', and Secure: true in production/HTTPS.
 */
export function getAuthCookieOptions(req?: Request, maxAgeSeconds: number = 7 * 24 * 60 * 60) {
  const isHttps = req
    ? req.headers.get('x-forwarded-proto') === 'https' || req.url.startsWith('https://')
    : true;
  const isSecure = process.env.NODE_ENV === 'production' || isHttps;

  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'strict' as const,
    maxAge: maxAgeSeconds,
    path: '/',
  };
}

