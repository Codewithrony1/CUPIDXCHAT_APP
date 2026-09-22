'use client';

export const dynamic = 'force-dynamic';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Heart, User, Lock, ArrowRight, ShieldCheck, Loader2 } from 'lucide-react';
import FloatingHearts from '@/components/FloatingHearts';

export default function Login() {
  const { loginWithGoogle, loginWithEmail } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleGoogleAuth = async () => {
    setError('');
    setSubmitting(true);
    try {
      await loginWithGoogle();
      // Keep loader active while browser navigates to Google accounts
      setTimeout(() => setSubmitting(false), 5000);
    } catch (err: any) {
      console.error('[LOGIN] Google auth error:', err);
      setError(err?.message || 'Google sign-in was cancelled or failed.');
      setSubmitting(false);
    }
  };

  const handleCredentialsAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password) return;
    setError('');
    setSubmitting(true);

    try {
      await loginWithEmail(identifier.trim(), password);
    } catch (err: any) {
      console.error('[LOGIN] Auth error:', err);
      setError(err?.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d0014] flex flex-col items-center justify-center p-4 relative overflow-hidden selection:bg-pink-500 selection:text-white">
      <FloatingHearts />

      <div className="w-full max-w-md space-y-6 relative z-10">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <Link href="/" className="inline-flex items-center space-x-2 group">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-pink-600 via-rose-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-pink-500/40 group-hover:scale-110 transition-transform">
              <Heart className="w-7 h-7 text-white fill-white animate-pulse" />
            </div>
            <span className="text-2xl font-black tracking-wider text-white">
              Cupid<span className="text-pink-400">X</span>
            </span>
          </Link>
          <div className="space-y-1">
            <h2 className="text-xl font-black text-white">Welcome Back</h2>
            <p className="text-xs text-pink-200/70">
              Sign in with Google or your account to start chatting
            </p>
          </div>
        </div>

        {/* Auth Card */}
        <div className="glass-romantic rounded-3xl p-6 sm:p-8 space-y-5 border border-pink-500/30 shadow-2xl backdrop-blur-xl">
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold leading-relaxed">
              {error}
            </div>
          )}

          {/* 1-Click Google Auth */}
          <button
            type="button"
            onClick={handleGoogleAuth}
            disabled={submitting}
            className="w-full py-3.5 px-4 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 font-black text-xs flex items-center justify-center space-x-3 shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin text-slate-900" />
            ) : (
              <>
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google</span>
              </>
            )}
          </button>

          {/* Divider */}
          <div className="flex items-center space-x-3 my-2">
            <div className="flex-1 h-px bg-pink-500/20" />
            <span className="text-[11px] font-bold text-pink-300/60 uppercase tracking-wider">or with credentials</span>
            <div className="flex-1 h-px bg-pink-500/20" />
          </div>

          {/* Login Form */}
          <form onSubmit={handleCredentialsAuth} className="space-y-4">
            <div className="space-y-1 text-left">
              <label className="text-[11px] font-bold text-pink-200/80 uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-pink-400" />
                <span>Username or Email</span>
              </label>
              <input
                type="text"
                required
                placeholder="username or email@example.com"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl glass-input text-xs font-medium focus:outline-none focus:ring-1 focus:ring-pink-500"
              />
            </div>

            <div className="space-y-1 text-left">
              <label className="text-[11px] font-bold text-pink-200/80 uppercase tracking-wider flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-pink-400" />
                <span>Password</span>
              </label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl glass-input text-xs font-medium focus:outline-none focus:ring-1 focus:ring-pink-500"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-pink-600 via-rose-500 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-pink-500/30 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Link to Signup */}
          <div className="text-center pt-2">
            <Link
              href="/signup"
              className="text-xs text-pink-300 hover:text-white font-bold transition-colors cursor-pointer"
            >
              Don&apos;t have an account? Sign up free
            </Link>
          </div>
        </div>

        {/* Security Note */}
        <div className="flex items-center justify-center space-x-1.5 text-xs text-pink-300/60 font-medium">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Secured by Clerk Authentication & TLS Transport Encryption</span>
        </div>
      </div>
    </div>
  );
}
