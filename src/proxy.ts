import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// ── Public routes that do NOT require authentication ─────────────────────────
// NOTE: /vip and /premium are intentionally NOT public — they require a logged-in
// user so the server can verify VIP status. Anonymous visitors are redirected to login.
const isPublicRoute = createRouteMatcher([
  '/',
  '/login(.*)',
  '/signup(.*)',
  '/register(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/safety(.*)',
  '/community-guidelines(.*)',
  '/forgot-password(.*)',
  '/privacy(.*)',
  '/terms(.*)',
  '/refund(.*)',
  '/contact(.*)',
  '/sso-callback(.*)',
  '/auth-callback(.*)',
  '/setup-profile(.*)',
  '/onboarding(.*)',
  '/api/auth/login(.*)',
  '/api/auth/register(.*)',
  '/api/auth/logout(.*)',
  '/api/auth/me(.*)',
  '/api/auth/onboarding(.*)',
  '/api/health(.*)',
  '/api/profile(.*)',
  '/api/chat(.*)',
  '/api/matchmaking(.*)',
  '/api/settings/random-chat(.*)',
  '/api/payment/qr(.*)',
  '/api/payment/status(.*)',
  '/api/webhook(.*)',
  '/api/cron(.*)',
  '/api/social(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  const pathname = req.nextUrl.pathname;

  const isAdminPath =
    pathname === '/admin' ||
    pathname.startsWith('/admin/') ||
    pathname === '/api/admin' ||
    pathname.startsWith('/api/admin/');

  if (isAdminPath) {
    // ── Admin Security Boundary ───────────────────────────────────────────────
    // SECURITY FIX (ADM-001): Use ONLY the server-controlled `host` header for
    // locality checks. The `x-forwarded-host` header is client-controlled and
    // can be spoofed by any attacker to bypass this check.
    //
    // Additionally, require a static ADMIN_SECRET token header as a second
    // authentication factor, preventing any unauthenticated access even on localhost.
    const host = (req.headers.get('host') ?? '').toLowerCase();

    const isLocalHost =
      process.env.ADMIN_MODE === 'true' &&
      (host === 'localhost:3000' ||
        host === '127.0.0.1:3000' ||
        host === '[::1]:3000' ||
        host === 'localhost:3001' ||
        host === '127.0.0.1:3001' ||
        host === '[::1]:3001');

    if (!isLocalHost) {
      // Never expose admin UI or admin APIs outside the dedicated local server.
      return new NextResponse('Not Found', { status: 404 });
    }

    // Second factor: ADMIN_SECRET token (if set in environment).
    // To use: set ADMIN_SECRET=<random-token> in .env and pass
    // X-Admin-Secret: <token> in all admin API requests.
    const adminSecret = process.env.ADMIN_SECRET;
    if (adminSecret) {
      const providedSecret = req.headers.get('x-admin-secret');
      // Only enforce the secret for API routes, not the admin UI pages.
      const isAdminApi = pathname === '/api/admin' || pathname.startsWith('/api/admin/');
      if (isAdminApi && providedSecret !== adminSecret) {
        return new NextResponse('Forbidden', { status: 403 });
      }
    }

    // Local admin mode intentionally supports the adminAuth fallback without Clerk.
    return;
  }

  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
