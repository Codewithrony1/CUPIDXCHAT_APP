import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  checkAuthRateLimit,
  recordAuthAttempt,
  applyRateLimitHeaders,
  getClientIp,
} from '@/lib/rateLimit';

export async function POST(req: Request) {
  const clientIp = getClientIp(req);

  try {
    const { emailOrUsername } = await req.json();

    if (!emailOrUsername || typeof emailOrUsername !== 'string') {
      const errRes = NextResponse.json(
        { error: 'Please enter your username or registered email address' },
        { status: 400 }
      );
      return applyRateLimitHeaders(errRes, checkAuthRateLimit(clientIp));
    }

    const cleanInput = emailOrUsername.toLowerCase().trim();

    // Rate limit: max 5 requests per 15 minutes per IP/Account
    const limitCheck = checkAuthRateLimit(clientIp, cleanInput, {
      ipMax: 5,
      ipWindowMs: 15 * 60 * 1000,
      accountMax: 3,
      accountWindowMs: 15 * 60 * 1000,
    });

    if (limitCheck.isBlocked) {
      const blockedRes = NextResponse.json(
        {
          error: `Too many password reset requests. Please try again in ${limitCheck.retryAfterSeconds} seconds.`,
          retryAfter: limitCheck.retryAfterSeconds,
        },
        { status: 429 }
      );
      return applyRateLimitHeaders(blockedRes, limitCheck);
    }

    // Record attempt to throttle subsequent spam
    recordAuthAttempt(clientIp, cleanInput, true);

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: cleanInput },
          { email: cleanInput },
        ],
      },
      select: { id: true, email: true, username: true },
    });

    // Uniform response to avoid username enumeration
    const successRes = NextResponse.json({
      success: true,
      message: 'If an account exists with that identifier, instructions have been sent.',
    });

    return applyRateLimitHeaders(successRes, limitCheck);
  } catch (error) {
    console.error('Password reset request error:', error);
    const errRes = NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    return applyRateLimitHeaders(errRes, checkAuthRateLimit(clientIp));
  }
}
