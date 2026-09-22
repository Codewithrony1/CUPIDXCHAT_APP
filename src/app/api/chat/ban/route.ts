import { NextResponse } from 'next/server';

/**
 * Personal Banned Users feature has been discontinued per product requirements.
 * Blocking functionality is the canonical privacy tool and is gated to VIP members via /api/chat/block.
 * Administrative safety suspensions remain active via /api/admin/users/ban.
 */

export async function GET() {
  return NextResponse.json(
    {
      error: 'The personal user ban feature has been discontinued. Please use the Block feature instead.',
      bans: [],
    },
    { status: 410 }
  );
}

export async function POST() {
  return NextResponse.json(
    {
      error: 'Personal user bans have been removed. Please use CupidX VIP Block functionality instead.',
      isVipRequired: true,
    },
    { status: 410 }
  );
}

