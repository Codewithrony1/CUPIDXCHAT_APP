import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { comparePassword, signToken, getAuthCookieOptions } from '@/lib/auth';
import {
  checkAuthRateLimit,
  recordAuthAttempt,
  applyRateLimitHeaders,
  getClientIp,
} from '@/lib/rateLimit';

export async function POST(req: Request) {
  const clientIp = getClientIp(req);

  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      const errRes = NextResponse.json({ error: 'Missing username or password' }, { status: 400 });
      return applyRateLimitHeaders(errRes, checkAuthRateLimit(clientIp));
    }

    const cleanUsername = username.toLowerCase().trim();

    // Dual-tier rate limiting: IP throttle (10 req/min) + Account lockout (5 failed attempts/15 mins)
    const limitCheck = checkAuthRateLimit(clientIp, cleanUsername);
    if (limitCheck.isBlocked) {
      const blockedRes = NextResponse.json(
        {
          error: `Too many login attempts. Please try again in ${limitCheck.retryAfterSeconds} seconds.`,
          retryAfter: limitCheck.retryAfterSeconds,
        },
        { status: 429 }
      );
      return applyRateLimitHeaders(blockedRes, limitCheck);
    }

    const user = await prisma.user.findUnique({
      where: { username: cleanUsername },
      include: { profile: true, subscription: true },
    });

    if (!user) {
      recordAuthAttempt(clientIp, cleanUsername, true);
      const postLimit = checkAuthRateLimit(clientIp, cleanUsername);
      const errRes = NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
      return applyRateLimitHeaders(errRes, postLimit);
    }

    if (user.isSuspended) {
      const suspendedRes = NextResponse.json(
        { error: 'Your account has been suspended' },
        { status: 403 }
      );
      return applyRateLimitHeaders(suspendedRes, limitCheck);
    }

    if (!user.passwordHash) {
      const oauthRes = NextResponse.json(
        { error: 'This account was created with Google. Please click Continue with Google.' },
        { status: 400 }
      );
      return applyRateLimitHeaders(oauthRes, limitCheck);
    }

    const match = await comparePassword(password, user.passwordHash);
    if (!match) {
      recordAuthAttempt(clientIp, cleanUsername, true);
      const postLimit = checkAuthRateLimit(clientIp, cleanUsername);
      const errRes = NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
      return applyRateLimitHeaders(errRes, postLimit);
    }

    // Success! Record successful auth (clears account lock)
    recordAuthAttempt(clientIp, cleanUsername, false);

    const token = signToken({
      userId: user.id,
      username: user.username,
      role: user.role,
    });

    const response = NextResponse.json({
      message: 'Logged in successfully',
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        profile: user.profile,
        subscription: user.subscription,
      },
    });

    // Enforce HttpOnly: true, Secure: true, SameSite: 'strict' (BUG-004)
    response.cookies.set('token', token, getAuthCookieOptions(req));

    const postLimit = checkAuthRateLimit(clientIp, cleanUsername);
    return applyRateLimitHeaders(response, postLimit);
  } catch (error) {
    console.error('Login error:', error);
    const errRes = NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    return applyRateLimitHeaders(errRes, checkAuthRateLimit(clientIp));
  }
}
