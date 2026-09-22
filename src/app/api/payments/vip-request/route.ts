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
    const { method, utrNumber, txHash, screenshotData, amount } = body;

    if (!method || !['qr', 'btc'].includes(method)) {
      return NextResponse.json({ error: 'Valid payment method (qr or btc) is required' }, { status: 400 });
    }

    // Validation for Option A: QR Code (UTR or Screenshot)
    if (method === 'qr') {
      const cleanUtr = (utrNumber || '').trim().replace(/\s+/g, '').toUpperCase();
      if (!cleanUtr && !screenshotData) {
        return NextResponse.json(
          { error: 'Please enter UTR number or upload payment screenshot proof.' },
          { status: 400 }
        );
      }

      if (cleanUtr) {
        // Check for duplicate pending/approved UTR
        const existingUtr = await prisma.vipRequest.findFirst({
          where: {
            utrNumber: cleanUtr,
            status: { in: ['pending', 'approved'] },
          },
        });
        if (existingUtr) {
          return NextResponse.json(
            { error: 'This UTR number has already been submitted for verification.' },
            { status: 409 }
          );
        }
      }
    }

    // Validation for Option B: Bitcoin (txHash required)
    if (method === 'btc') {
      const cleanHash = (txHash || '').trim();
      if (!cleanHash || cleanHash.length < 20) {
        return NextResponse.json(
          { error: 'Please enter a valid Bitcoin transaction hash (txid).' },
          { status: 400 }
        );
      }

      // Check for duplicate pending/approved txHash
      const existingTx = await prisma.vipRequest.findFirst({
        where: {
          txHash: cleanHash,
          status: { in: ['pending', 'approved'] },
        },
      });

      if (existingTx) {
        return NextResponse.json(
          { error: 'This Bitcoin transaction hash has already been submitted for verification.' },
          { status: 409 }
        );
      }
    }

    // Save screenshot proof if provided (5MB size cap check handled on client & server)
    let proofUrl: string | null = null;
    if (screenshotData && screenshotData.startsWith('data:image/')) {
      const clerkId = user.clerkUserId || user.id;
      const uploadRes = await saveBase64Image(screenshotData, 'uploads/vip-proofs', `payment-proof_${clerkId}`);
      if (uploadRes.success && uploadRes.url) {
        proofUrl = uploadRes.url;
      } else {
        return NextResponse.json(
          { error: uploadRes.error || 'Failed to process screenshot proof.' },
          { status: uploadRes.statusCode || 400 }
        );
      }
    }

    // Create VipRequest record
    const vipRequest = await prisma.vipRequest.create({
      data: {
        userId: user.id,
        method,
        utrNumber: method === 'qr' ? utrNumber?.trim().toUpperCase() : null,
        txHash: method === 'btc' ? txHash?.trim() : null,
        proofUrl,
        amount: amount ? parseFloat(amount) : 99.0,
        status: 'pending',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'VIP Payment request submitted successfully. Usually reviewed within 24 hours.',
      request: vipRequest,
    });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { error: 'This payment reference has already been submitted for verification.' },
        { status: 409 }
      );
    }
    console.error('Error submitting VIP request:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
