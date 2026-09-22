import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { validateImageBuffer, estimateGenderFromImage } from '@/lib/aiGenderService';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    // 1. Authenticate user server-side
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Please log in first.' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { image, consent } = body;

    // 2. Explicit User Consent Check
    if (!consent) {
      return NextResponse.json(
        {
          error: 'Explicit user consent is required before performing optional AI gender estimation.',
          isConsentRequired: true,
        },
        { status: 400 }
      );
    }

    if (!image || typeof image !== 'string') {
      return NextResponse.json(
        { error: 'Please provide an image for optional AI gender estimation.' },
        { status: 400 }
      );
    }

    // 3. Extract and Clean Base64 Payload
    const commaIdx = image.indexOf(',');
    const rawBase64 = commaIdx !== -1 ? image.slice(commaIdx + 1) : image;
    const cleanBase64 = rawBase64.replace(/\s+/g, '');

    if (!cleanBase64) {
      return NextResponse.json({ error: 'Empty image payload.' }, { status: 400 });
    }

    let buffer: Buffer;
    try {
      buffer = Buffer.from(cleanBase64, 'base64');
    } catch {
      return NextResponse.json({ error: 'Invalid base64 image encoding.' }, { status: 400 });
    }

    // 4. Server-side validation: 5 MB cap & binary magic bytes check
    const validation = validateImageBuffer(buffer);
    if (!validation.valid || !validation.mimeType) {
      return NextResponse.json(
        { error: validation.error || 'Invalid image file.' },
        { status: 400 }
      );
    }

    // 5. In-Memory Ephemeral Analysis (Never permanently stored for estimation)
    const aiResult = await estimateGenderFromImage(buffer, validation.mimeType);

    // 6. Persist AI estimation separately from user-selected gender
    // CRITICAL: user.gender and profile.gender are NEVER overwritten!
    const updatedProfile = await prisma.profile.upsert({
      where: { userId: user.id },
      update: {
        aiGenderEstimate: aiResult.estimate,
        aiGenderConfidence: aiResult.confidence,
        aiGenderEstimatedAt: new Date(),
        aiGenderConsent: true,
      },
      create: {
        userId: user.id,
        gender: user.gender || 'unspecified',
        aiGenderEstimate: aiResult.estimate,
        aiGenderConfidence: aiResult.confidence,
        aiGenderEstimatedAt: new Date(),
        aiGenderConsent: true,
      },
    });

    return NextResponse.json({
      success: true,
      aiGenderEstimate: updatedProfile.aiGenderEstimate,
      aiGenderConfidence: updatedProfile.aiGenderConfidence,
      aiGenderEstimatedAt: updatedProfile.aiGenderEstimatedAt,
      userSelectedGender: user.gender || updatedProfile.gender,
      message: 'Optional AI estimation completed. Your profile gender remains the official source of truth.',
    });
  } catch (error) {
    console.error('Error in optional AI gender estimation:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const updatedProfile = await prisma.profile.update({
      where: { userId: user.id },
      data: {
        aiGenderEstimate: 'unknown',
        aiGenderConfidence: null,
        aiGenderEstimatedAt: null,
        aiGenderConsent: false,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'AI gender estimate cleared successfully.',
      aiGenderEstimate: updatedProfile.aiGenderEstimate,
      userSelectedGender: user.gender || updatedProfile.gender,
    });
  } catch (error) {
    console.error('Error clearing AI gender estimate:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
