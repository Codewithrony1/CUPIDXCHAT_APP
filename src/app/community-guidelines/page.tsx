'use client';

import React from 'react';
import Link from 'next/link';
import {
  Heart,
  ArrowLeft,
  CheckCircle,
  XCircle,
  AlertCircle,
  Shield,
  Smile,
  Ban,
} from 'lucide-react';
import FloatingHearts from '@/components/FloatingHearts';

export default function CommunityGuidelinesPage() {
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
            Cupid<span className="text-pink-400">X</span> Rules
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-10 space-y-10 relative z-10">
        {/* Title */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-bold">
            <Shield className="w-4 h-4 text-purple-400" />
            <span>Community Standards</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
            Community Guidelines
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto leading-relaxed">
            To keep CupidX a positive, welcoming, and safe space for everyone, all members must abide by these rules. Violations will lead to permanent account suspension.
          </p>
        </div>

        {/* Dos and Don'ts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Allowed */}
          <div className="glass-romantic rounded-3xl p-6 space-y-4 border border-emerald-500/30 bg-emerald-500/[0.02] shadow-xl">
            <h2 className="text-base font-black text-emerald-300 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              <span>What We Encourage</span>
            </h2>
            <ul className="space-y-3 text-xs text-slate-300">
              <li className="flex items-start gap-2">
                <Smile className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Be polite and respectful:</strong> Treat every person you match with kindness and courtesy.</span>
              </li>
              <li className="flex items-start gap-2">
                <Smile className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Have fun conversations:</strong> Share interests, music, stories, and humorous banter.</span>
              </li>
              <li className="flex items-start gap-2">
                <Smile className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Respect boundaries:</strong> If someone asks to change the topic or skips, accept it with grace.</span>
              </li>
              <li className="flex items-start gap-2">
                <Smile className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Report bad behavior:</strong> Help us keep CupidX clean by reporting bad actors.</span>
              </li>
            </ul>
          </div>

          {/* Strictly Prohibited */}
          <div className="glass-romantic rounded-3xl p-6 space-y-4 border border-rose-500/30 bg-rose-500/[0.02] shadow-xl">
            <h2 className="text-base font-black text-rose-300 flex items-center gap-2">
              <XCircle className="w-5 h-5 text-rose-400" />
              <span>Zero-Tolerance Violations</span>
            </h2>
            <ul className="space-y-3 text-xs text-slate-300">
              <li className="flex items-start gap-2">
                <Ban className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span><strong>Harassment &amp; Hate Speech:</strong> Racism, sexism, homophobic slurs, or targeting individuals.</span>
              </li>
              <li className="flex items-start gap-2">
                <Ban className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span><strong>Sexually Explicit Media:</strong> Sending unsolicited explicit, pornographic, or non-consensual images.</span>
              </li>
              <li className="flex items-start gap-2">
                <Ban className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span><strong>Underage Use:</strong> CupidX is strictly for individuals aged 18 and older.</span>
              </li>
              <li className="flex items-start gap-2">
                <Ban className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span><strong>Scams, Spam &amp; Phishing:</strong> Commercial solicitation, selling items, or spreading malicious links.</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Enforcement notice */}
        <div className="glass-romantic rounded-3xl p-6 border border-pink-500/30 bg-white/[0.02] text-xs text-slate-300 space-y-2">
          <h3 className="text-sm font-black text-white flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-pink-400" />
            <span>Enforcement &amp; Account Bans</span>
          </h3>
          <p className="leading-relaxed">
            Our automated security heuristics and human moderation team monitor reports around the clock. Accounts found violating these guidelines will be banned immediately with no refund of VIP privileges.
          </p>
        </div>

        {/* Footer links */}
        <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400 pt-4 border-t border-white/10">
          <Link href="/safety" className="hover:text-pink-300 underline transition-colors">
            Safety Center
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
