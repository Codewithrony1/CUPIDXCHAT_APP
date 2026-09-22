'use client';

import React from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Lock,
  EyeOff,
  AlertTriangle,
  UserX,
  Flag,
  Heart,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react';
import FloatingHearts from '@/components/FloatingHearts';

export default function SafetyPage() {
  return (
    <div className="min-h-screen bg-[#07000e] text-white selection:bg-pink-500 selection:text-white relative overflow-x-hidden font-sans">
      <FloatingHearts />

      {/* Header / Nav */}
      <header className="sticky top-0 z-30 bg-[#0d0014]/90 backdrop-blur-xl border-b border-pink-500/20 px-4 py-3.5 flex items-center justify-between max-w-5xl mx-auto">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-xs font-bold text-pink-300 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-pink-600 to-purple-600 flex items-center justify-center shadow-md shadow-pink-500/30">
            <Heart className="w-4 h-4 text-white fill-white" />
          </div>
          <span className="text-sm font-black text-white tracking-wider">
            Cupid<span className="text-pink-400">X</span> Safety
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-10 space-y-10 relative z-10">
        {/* Hero Section */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-pink-500/10 border border-pink-500/30 text-pink-300 text-xs font-bold">
            <ShieldCheck className="w-4 h-4 text-pink-400" />
            <span>Your Safety is Our Top Priority</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
            Safety Center &amp; Guidelines
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto leading-relaxed">
            CupidX is built for fun, positive, and spontaneous 1-to-1 conversations. Learn how we protect you and what you can do to stay safe.
          </p>
        </div>

        {/* Safety Pillars Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="glass-romantic rounded-3xl p-6 space-y-3 border border-pink-500/20 shadow-xl bg-white/[0.02]">
            <div className="w-10 h-10 rounded-2xl bg-pink-500/20 border border-pink-500/40 flex items-center justify-center text-pink-400">
              <EyeOff className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">100% Anonymous by Default</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Your real email, phone number, and private account identifiers are never shown to your chat partners. You chat with only your chosen display name and emoji avatar.
            </p>
          </div>

          <div className="glass-romantic rounded-3xl p-6 space-y-3 border border-pink-500/20 shadow-xl bg-white/[0.02]">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Ephemeral Messaging</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              When a random chat ends or you click "NEXT", the active conversation closes and room messages are cleanly purged. We do not store permanent chat histories for random chats.
            </p>
          </div>

          <div className="glass-romantic rounded-3xl p-6 space-y-3 border border-pink-500/20 shadow-xl bg-white/[0.02]">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
              <Flag className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Instant User Reporting</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Encounter someone violating community standards? Use the built-in Report button during any chat. Our moderation team promptly reviews reported accounts.
            </p>
          </div>

          <div className="glass-romantic rounded-3xl p-6 space-y-3 border border-pink-500/20 shadow-xl bg-white/[0.02]">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <UserX className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Instant Block &amp; Skip</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Blocking a partner immediately terminates the conversation and permanently prevents you from ever matching with that user again across the platform.
            </p>
          </div>
        </div>

        {/* Safety Tips Checklist */}
        <div className="glass-romantic rounded-3xl p-6 sm:p-8 space-y-6 border border-pink-500/30 bg-white/[0.02] shadow-2xl">
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-pink-400" />
            <span>Essential Tips for Staying Safe</span>
          </h2>

          <div className="space-y-4 text-xs text-slate-300">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white">Never share financial details:</strong> Never send money, cryptocurrency, bank accounts, or UPI handles to strangers online.
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white">Protect personal contact information:</strong> Keep your home address, workplace, school, phone number, and personal social handles private.
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white">Beware of suspicious links:</strong> Do not open external links, download unknown files, or verify OTPs sent by other chat users.
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white">You have full control:</strong> If anyone makes you feel uncomfortable, press <strong>NEXT</strong> or <strong>Block</strong> immediately.
              </div>
            </div>
          </div>
        </div>

        {/* Footer links */}
        <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400 pt-4 border-t border-white/10">
          <Link href="/community-guidelines" className="hover:text-pink-300 underline transition-colors">
            Community Guidelines
          </Link>
          <Link href="/privacy" className="hover:text-pink-300 underline transition-colors">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-pink-300 underline transition-colors">
            Terms of Service
          </Link>
          <Link href="/refund" className="hover:text-pink-300 underline transition-colors">
            Refund Policy
          </Link>
          <Link href="/contact" className="hover:text-pink-300 underline transition-colors">
            Contact
          </Link>
        </div>
      </main>
    </div>
  );
}
