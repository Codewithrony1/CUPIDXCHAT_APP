import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { saveBase64Image } from '@/lib/safeImageUpload';

export async function POST(req: Request) {
  try {
    // 1. Authenticate user server-side via Clerk / Session
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Please log in first.' }, { status: 401 });
    }

    const clerkEmail: string | null = user.email || null;
    const clerkName: string | null = user.fullName || user.displayName || user.username;
    const clerkId: string = user.clerkUserId || user.id;

    const body = await req.json().catch(() => ({}));
    const { plan = 'monthly', region = 'india', paymentId, screenshot, utrNumber } = body;

    const effectivePaymentId = (paymentId || utrNumber || '').trim();
    const hasScreenshot = Boolean(screenshot && screenshot.startsWith('data:image/'));

    // 2. Validation: Require at least UTR or Screenshot
    if (!effectivePaymentId && !hasScreenshot) {
      return NextResponse.json(
        { error: 'Please enter a valid Payment / UTR reference number or upload a payment screenshot.' },
        { status: 400 }
      );
    }

    // 3. Duplicate UTR Protection (Requirement 16)
    if (effectivePaymentId) {
      const cleanUtr = effectivePaymentId.replace(/\s+/g, '').toUpperCase();
      const existingUtr = await prisma.paymentRequest.findFirst({
        where: {
          paymentId: cleanUtr,
          status: { in: ['pending', 'UNDER_REVIEW', 'approved', 'APPROVED'] },
        },
      });

      if (existingUtr) {
        return NextResponse.json(
          { error: 'This transaction reference / UTR has already been submitted.' },
          { status: 409 }
        );
      }
    }

    // 4. Block multiple active pending requests for the same user
    const existingPending = await prisma.paymentRequest.findFirst({
      where: {
        userId: user.id,
        status: { in: ['pending', 'UNDER_REVIEW'] },
      },
    });

    if (existingPending) {
      return NextResponse.json(
        {
          error: 'You already have a payment request under review. Please wait for admin verification.',
          hasPending: true,
          request: existingPending,
        },
        { status: 409 }
      );
    }

    // 5. Screenshot Processing (Secure MIME & Magic Bytes Validation via safeImageUpload)
    let screenshotUrl: string | null = null;
    let screenshotKey: string | null = null;

    if (hasScreenshot) {
      const uploadRes = await saveBase64Image(
        screenshot,
        'uploads/receipts',
        `payment-proof_${clerkId}`,
        5 * 1024 * 1024
      );

      if (!uploadRes.success) {
        return NextResponse.json(
          { error: uploadRes.error || 'Failed to process payment screenshot.' },
          { status: uploadRes.statusCode || 400 }
        );
      }

      screenshotUrl = uploadRes.url || null;
      screenshotKey = uploadRes.filename || null;
    }

    // 6. Plan & Pricing Configuration (Server-Side Canonical Source of Truth)
    const normalizedPlan = (plan || 'monthly').toLowerCase().trim();
    let durationDays = 30;
    let amount = 29.0;
    let planId = 'vip_monthly';
    let canonicalPlan = 'monthly';

    if (normalizedPlan.includes('year') || normalizedPlan === '365days' || normalizedPlan === 'vip_yearly' || normalizedPlan === 'yearly') {
      durationDays = 365;
      amount = 399.0;
      planId = 'vip_yearly';
      canonicalPlan = 'yearly';
    } else if (normalizedPlan.includes('3month') || normalizedPlan.includes('three') || normalizedPlan === 'vip_3months' || normalizedPlan === '3months') {
      durationDays = 90;
      amount = 99.0;
      planId = 'vip_3months';
      canonicalPlan = '3months';
    } else {
      durationDays = 30;
      amount = 29.0;
      planId = 'vip_monthly';
      canonicalPlan = 'monthly';
    }

    // Check if custom price setting is configured in database
    try {
      const settingKey = canonicalPlan === 'yearly' ? 'indiaPriceYearly' : (canonicalPlan === '3months' ? 'indiaPriceThreeMonths' : 'indiaPriceMonthly');
      const customPrice = await prisma.appSetting.findUnique({ where: { key: settingKey } });
      if (customPrice && !isNaN(parseFloat(customPrice.value))) {
        amount = parseFloat(customPrice.value);
      }
    } catch (e) {}

    // 7. Generate Request ID
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
    const requestId = `CPX-${dateStr}-${randomHex}`;

    // 8. Create PaymentRequest in database
    const paymentRequest = await prisma.paymentRequest.create({
      data: {
        requestId,
        userId: user.id,
        clerkUserId: clerkId,
        userEmail: clerkEmail,
        userFullName: clerkName,
        username: user.username,
        plan: canonicalPlan,
        planId,
        region: region || 'india',
        amount,
        currency: 'INR',
        paymentId: effectivePaymentId || null,
        screenshotUrl,
        screenshotKey,
        status: 'UNDER_REVIEW',
      },
    });

    // 9. Write Audit Log
    try {
      await prisma.adminLog.create({
        data: {
          adminUserId: user.id,
          adminClerkId: clerkId,
          action: 'PAYMENT_PROOF_SUBMITTED',
          targetUserId: user.id,
          entityType: 'PAYMENT',
          entityId: paymentRequest.id,
          details: `User @${user.username} (Clerk ID: ${clerkId}) submitted payment proof for ${normalizedPlan} (₹${amount}). UTR: ${effectivePaymentId || 'None'}. ID: ${requestId}`,
        },
      });
    } catch (e) {}

    return NextResponse.json({
      success: true,
      message: 'Payment proof submitted. Your payment is now under review by administration.',
      request: paymentRequest,
    });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { error: 'This transaction reference / UTR has already been submitted.' },
        { status: 409 }
      );
    }
    console.error('Error submitting payment proof:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
