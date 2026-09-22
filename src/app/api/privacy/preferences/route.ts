import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION } from '@/lib/config/policy';

export async function PATCH(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    if (typeof body.marketingConsent !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid preferences payload. marketingConsent must be a boolean.' },
        { status: 400 }
      );
    }

    const now = new Date();
    const updatedConsent = await prisma.userConsent.upsert({
      where: { userId: user.id },
      update: {
        marketingConsent: body.marketingConsent,
        marketingConsentUpdatedAt: now,
      },
      create: {
        userId: user.id,
        marketingConsent: body.marketingConsent,
        marketingConsentUpdatedAt: now,
        termsVersion: CURRENT_TERMS_VERSION,
        privacyVersion: CURRENT_PRIVACY_VERSION,
        consentTimestamp: now,
      },
    });

    return NextResponse.json({
      success: true,
      message: body.marketingConsent
        ? 'Subscribed to product updates & announcements'
        : 'Unsubscribed from marketing communications',
      marketingConsent: updatedConsent.marketingConsent,
      updatedAt: updatedConsent.marketingConsentUpdatedAt,
    });
  } catch (error) {
    console.error('Update preferences error:', error);
    return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 });
  }
}
