import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword, signToken, getAuthCookieOptions } from '@/lib/auth';
import { usernameSchema } from '@/lib/validation/username';
import {
  checkAuthRateLimit,
  recordAuthAttempt,
  applyRateLimitHeaders,
  getClientIp,
} from '@/lib/rateLimit';

export async function POST(req: Request) {
  const clientIp = getClientIp(req);

  try {
    // Check IP rate limit for registration attempts (max 10 requests / 60s)
    const limitCheck = checkAuthRateLimit(clientIp);
    if (limitCheck.isBlocked) {
      const blockedRes = NextResponse.json(
        {
          error: `Too many registration attempts. Please try again in ${limitCheck.retryAfterSeconds} seconds.`,
          retryAfter: limitCheck.retryAfterSeconds,
        },
        { status: 429 }
      );
      return applyRateLimitHeaders(blockedRes, limitCheck);
    }

    const { fullName, username, password } = await req.json();

    if (!fullName || !username || !password) {
      const errRes = NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
      return applyRateLimitHeaders(errRes, limitCheck);
    }

    const cleanUsername = username.toLowerCase().trim();

    // Validate username against Zod schema & reserved list
    const usernameValidation = usernameSchema.safeParse(cleanUsername);
    if (!usernameValidation.success) {
      const errRes = NextResponse.json(
        { error: usernameValidation.error.issues[0]?.message || 'Invalid username' },
        { status: 400 }
      );
      return applyRateLimitHeaders(errRes, limitCheck);
    }

    if (password.length < 6) {
      const errRes = NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
      return applyRateLimitHeaders(errRes, limitCheck);
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { username: cleanUsername },
    });

    if (existingUser) {
      recordAuthAttempt(clientIp, cleanUsername, true);
      const postLimit = checkAuthRateLimit(clientIp);
      const errRes = NextResponse.json({ error: 'Username is already taken' }, { status: 400 });
      return applyRateLimitHeaders(errRes, postLimit);
    }

    const hashed = await hashPassword(password);

    // Create User and Profile
    const user = await prisma.user.create({
      data: {
        fullName,
        username: cleanUsername,
        passwordHash: hashed,
        profile: {
          create: {
            bio: "Hey there! I am using CupidX.",
            avatarUrl: `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${cleanUsername}`,
            themePreference: 'purple',
          },
        },
      },
    });

    recordAuthAttempt(clientIp, cleanUsername, false);

    const token = signToken({
      userId: user.id,
      username: user.username,
      role: user.role,
    });

    const response = NextResponse.json({
      message: 'Registered successfully',
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
      },
    });

    response.cookies.set('token', token, getAuthCookieOptions(req));

    const postLimit = checkAuthRateLimit(clientIp);
    return applyRateLimitHeaders(response, postLimit);
  } catch (error: any) {
    console.error('Registration error:', error);
    const errRes = NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    return applyRateLimitHeaders(errRes, checkAuthRateLimit(clientIp));
  }
}
