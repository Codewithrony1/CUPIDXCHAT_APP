import { getCurrentUser } from '@/lib/auth';

/**
 * Admin is intentionally LOCAL-ONLY.
 * The admin UI/API must only run from a local development server
 * with ADMIN_MODE enabled (localhost:3000 or localhost:3001). Production users never receive
 * admin authorization, even if their database role/email says ADMIN.
 *
 * SECURITY (ADM-001): This function uses ONLY the server-controlled `host` header
 * for locality verification. The `x-forwarded-host` header is explicitly excluded
 * because it is client-supplied and trivially spoofable by any attacker.
 */
function isLocalAdminRequest(req: Request): boolean {
  const adminMode = process.env.ADMIN_MODE === 'true';
  if (!adminMode) return false;

  // SECURITY: Read ONLY from the `host` header — never from `x-forwarded-host`.
  const url = new URL(req.url);
  const host = (req.headers.get('host') || url.host || '').toLowerCase();

  return (
    host === 'localhost:3000' ||
    host === '127.0.0.1:3000' ||
    host === '[::1]:3000' ||
    host === 'localhost:3001' ||
    host === '127.0.0.1:3001' ||
    host === '[::1]:3001'
  );
}

// Use a concrete type so TypeScript can narrow properly after destructuring
type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export interface AdminAccessResult {
  authorized: boolean;
  user: (CurrentUser & { role: string }) | null;
  adminId: string | null;
  adminClerkUserId: string | null;
}

export async function verifyAdminAccess(req: Request): Promise<AdminAccessResult> {
  // Hard security boundary: ADMIN_MODE + loopback host are both required.
  if (!isLocalAdminRequest(req)) {
    return { authorized: false, user: null, adminId: null, adminClerkUserId: null };
  }

  // SECURITY (ADM-001): An authenticated Clerk session is REQUIRED.
  // The previous unauthenticated fallback has been removed — all admin access
  // now requires a valid Clerk session.
  const user = await getCurrentUser(req);

  if (!user) {
    return { authorized: false, user: null, adminId: null, adminClerkUserId: null };
  }

  const adminUser = { ...user, role: 'ADMIN' } as CurrentUser & { role: string };

  return {
    authorized: true,
    user: adminUser,
    adminId: user.id,
    adminClerkUserId: user.clerkUserId || null,
  };
}
