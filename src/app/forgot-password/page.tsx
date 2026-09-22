'use client';

import React from 'react';
import { SignIn } from '@clerk/nextjs';
import Link from 'next/link';
import { Heart } from 'lucide-react';

export default function ForgotPasswordPage() {
  return (
    <main className="min-h-[100dvh] bg-[#0d0014] text-white flex flex-col items-center justify-center p-4">
      <div className="mb-6 text-center">
        <Link href="/" className="inline-flex items-center gap-2">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pink-600 via-rose-500 to-fuchsia-500 flex items-center justify-center">
            <Heart className="w-6 h-6 text-white fill-white" />
          </div>
          <span className="text-xl font-black">Cupid<span className="text-pink-400">X</span></span>
        </Link>
        <h1 className="mt-4 text-lg font-black">Reset your password</h1>
        <p className="mt-1 text-xs text-pink-200/70">Use Clerk's secure account recovery flow.</p>
      </div>
      <SignIn
        routing="path"
        path="/forgot-password"
        forceRedirectUrl="/auth-callback"
        fallbackRedirectUrl="/auth-callback"
      />
    </main>
  );
}
