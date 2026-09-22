import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { saveBase64Image } from '@/lib/safeImageUpload';

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { paymentId, utrNumber, screenshotData } = body;

    if (!paymentId) {
      return NextResponse.json({ error: 'Payment ID is required' }, { status: 400 });
    }

    const cleanUtr = (utrNumber || '').trim().replace(/\s+/g, '').toUpperCase();

    // 12-Digit UTR Validation
    if (!cleanUtr || cleanUtr.length < 10 || cleanUtr.length > 18) {
      return NextResponse.json(
        { error: 'Invalid UTR / UPI Reference number. Must be between 10 to 18 digits.' },
        { status: 400 }
      );
    }

    const paymentRecord = await prisma.manualUpiPayment.findFirst({
      where: {
        OR: [{ paymentId }, { id: paymentId }],
        userId: user.id,
      },
    });

    if (!paymentRecord) {
      return NextResponse.json({ error: 'Payment record not found' }, { status: 404 });
    }

    if (paymentRecord.status === 'PAID') {
      return NextResponse.json({ error: 'Payment has already been approved and completed.' }, { status: 400 });
    }

    // Check if UTR was already submitted for another payment
    const existingUtr = await prisma.manualUpiPayment.findFirst({
      where: {
        utrNumber: cleanUtr,
        id: { not: paymentRecord.id },
        status: { in: ['UNDER_REVIEW', 'PAID'] },
      },
    });

    if (existingUtr) {
      return NextResponse.json(
        { error: 'This UTR / Reference number has already been submitted for verification.' },
        { status: 409 }
      );
    }

    let screenshotUrl = paymentRecord.screenshotUrl;

    if (screenshotData && screenshotData.startsWith('data:image/')) {
      const clerkId = user.clerkUserId || user.id;
      const uploadRes = await saveBase64Image(screenshotData, 'uploads/receipts', `payment-proof_${clerkId}`);
      if (uploadRes.success && uploadRes.url) {
        screenshotUrl = uploadRes.url;
      } else {
        return NextResponse.json(
          { error: uploadRes.error || 'Failed to process payment screenshot.' },
          { status: uploadRes.statusCode || 400 }
        );
      }
    }

    const updatedPayment = await prisma.manualUpiPayment.update({
      where: { id: paymentRecord.id },
      data: {
        utrNumber: cleanUtr,
        screenshotUrl,
        status: 'UNDER_REVIEW',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'UTR submitted successfully. Your payment is now under review.',
      payment: updatedPayment,
    });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { error: 'This UTR / Reference number has already been submitted for verification.' },
        { status: 409 }
      );
    }
    console.error('Error submitting UTR for manual UPI payment:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
