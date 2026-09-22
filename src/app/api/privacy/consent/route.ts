import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION } from '@/lib/config/policy';

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const consent = await prisma.userConsent.findUnique({
      where: { userId: user.id },
    });

    return NextResponse.json({
      consent: consent || null,
      currentVersions: {
        termsVersion: CURRENT_TERMS_VERSION,
        privacyVersion: CURRENT_PRIVACY_VERSION,
      },
      isUpToDate: consent
        ? consent.termsVersion === CURRENT_TERMS_VERSION &&
          consent.privacyVersion === CURRENT_PRIVACY_VERSION &&
          consent.termsAccepted &&
          consent.privacyAcknowledged
        : false,
    });
  } catch (error) {
    console.error('Fetch consent error:', error);
    return NextResponse.json({ error: 'Failed to fetch consent records' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      termsAccepted,
      privacyAcknowledged,
      ageConfirmed,
      randomChatAcknowledged,
      locationProcessingAcknowledged,
      marketingConsent,
    } = body;

    const now = new Date();

    const consent = await prisma.userConsent.upsert({
      where: { userId: user.id },
      update: {
        termsAccepted: termsAccepted !== undefined ? Boolean(termsAccepted) : undefined,
        termsAcceptedAt: termsAccepted ? now : undefined,
        privacyAcknowledged: privacyAcknowledged !== undefined ? Boolean(privacyAcknowledged) : undefined,
        privacyAcknowledgedAt: privacyAcknowledged ? now : undefined,
        ageConfirmed: ageConfirmed !== undefined ? Boolean(ageConfirmed) : undefined,
        ageConfirmedAt: ageConfirmed ? now : undefined,
        randomChatAcknowledged: randomChatAcknowledged !== undefined ? Boolean(randomChatAcknowledged) : undefined,
        randomChatAcknowledgedAt: randomChatAcknowledged ? now : undefined,
        locationProcessingAcknowledged: locationProcessingAcknowledged !== undefined ? Boolean(locationProcessingAcknowledged) : undefined,
        locationProcessingAcknowledgedAt: locationProcessingAcknowledged ? now : undefined,
        marketingConsent: marketingConsent !== undefined ? Boolean(marketingConsent) : undefined,
        marketingConsentUpdatedAt: marketingConsent !== undefined ? now : undefined,
        termsVersion: CURRENT_TERMS_VERSION,
        privacyVersion: CURRENT_PRIVACY_VERSION,
        consentTimestamp: now,
      },
      create: {
        userId: user.id,
        termsAccepted: Boolean(termsAccepted),
        termsAcceptedAt: termsAccepted ? now : null,
        privacyAcknowledged: Boolean(privacyAcknowledged),
        privacyAcknowledgedAt: privacyAcknowledged ? now : null,
        ageConfirmed: Boolean(ageConfirmed),
        ageConfirmedAt: ageConfirmed ? now : null,
        randomChatAcknowledged: Boolean(randomChatAcknowledged),
        randomChatAcknowledgedAt: randomChatAcknowledged ? now : null,
        locationProcessingAcknowledged: Boolean(locationProcessingAcknowledged),
        locationProcessingAcknowledgedAt: locationProcessingAcknowledged ? now : null,
        marketingConsent: Boolean(marketingConsent),
        marketingConsentUpdatedAt: marketingConsent ? now : null,
        termsVersion: CURRENT_TERMS_VERSION,
        privacyVersion: CURRENT_PRIVACY_VERSION,
        consentTimestamp: now,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Consent records successfully saved',
      consent,
    });
  } catch (error) {
    console.error('Update consent error:', error);
    return NextResponse.json({ error: 'Failed to update consent records' }, { status: 500 });
  }
}
