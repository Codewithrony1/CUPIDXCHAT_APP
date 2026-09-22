import { NextResponse } from 'next/server';
import { getAuthCookieOptions } from '@/lib/auth';

export async function POST(req: Request) {
  const response = NextResponse.json({ success: true, message: 'Logged out successfully' });

  // Completely clear auth cookie with strict security flags
  response.cookies.set('token', '', {
    ...getAuthCookieOptions(req, 0),
    expires: new Date(0),
    maxAge: 0,
  });

  return response;
}
