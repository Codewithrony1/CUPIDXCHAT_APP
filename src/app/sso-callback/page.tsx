'use client';

export const dynamic = 'force-dynamic';

import { AuthenticateWithRedirectCallback } from '@clerk/nextjs';
import FloatingHearts from '@/components/FloatingHearts';

export default function SSOCallbackPage() {
  return (
    <div className="min-h-[100dvh] bg-[#0d0014] text-white flex items-center justify-center relative overflow-hidden">
      <FloatingHearts />
      <div className="text-center space-y-3 z-10">
        <AuthenticateWithRedirectCallback
          signInForceRedirectUrl="/auth-callback"
          signUpForceRedirectUrl="/auth-callback"
          signInFallbackRedirectUrl="/auth-callback"
          signUpFallbackRedirectUrl="/auth-callback"
          continueSignUpUrl="/setup-profile"
        />
        <p className="text-xs font-bold text-pink-300">Completing sign in to CupidX...</p>
      </div>
    </div>
  );
}
