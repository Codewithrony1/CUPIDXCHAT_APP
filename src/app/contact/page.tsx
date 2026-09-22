'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Mail,
  Shield,
  CreditCard,
  Heart,
  MessageSquare,
  AlertOctagon,
  Building,
  CheckCircle2,
  Send,
  ExternalLink,
} from 'lucide-react';
import FloatingHearts from '@/components/FloatingHearts';
import {
  OPERATOR_NAME,
  OPERATOR_LEGAL_STATEMENT,
  OPERATOR_ADDRESS_PLACEHOLDER,
  SUPPORT_EMAIL,
  PRIVACY_CONTACT_EMAIL,
  PAYMENT_SUPPORT_EMAIL,
  ABUSE_REPORT_EMAIL,
} from '@/lib/config/policy';

export default function ContactPage() {
  const [selectedCategory, setSelectedCategory] = useState<'general' | 'privacy' | 'billing' | 'safety'>('general');
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedEmail(text);
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  return (
    <div className="min-h-screen bg-[#07000e] text-white p-4 sm:p-8 relative selection:bg-pink-500 selection:text-white">
      <FloatingHearts />

      <div className="max-w-4xl mx-auto space-y-6 relative z-10">
        {/* Navigation */}
        <div className="flex items-center justify-between border-b border-pink-500/20 pb-5">
          <div className="flex items-center space-x-3">
            <Link
              href="/"
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-pink-300 hover:text-white transition-all cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center space-x-2">
              <Mail className="w-6 h-6 text-pink-400" />
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">Contact &amp; Grievances</h1>
                <p className="text-[11px] text-pink-300/70">Official support and privacy grievance channels</p>
              </div>
            </div>
          </div>
          <Link href="/" className="flex items-center space-x-1.5 text-sm font-bold text-pink-300">
            <Heart className="w-4 h-4 text-pink-500 fill-pink-500" />
            <span>CupidX</span>
          </Link>
        </div>

        {/* Content Card */}
        <div className="rounded-3xl bg-[#11001c]/90 border border-pink-500/20 p-6 sm:p-8 space-y-8 text-xs sm:text-sm text-slate-300 leading-relaxed shadow-2xl backdrop-blur-md">
          {/* Operator Statement */}
          <div className="p-4 rounded-2xl bg-pink-500/10 border border-pink-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-pink-200">
              <Building className="w-4 h-4 text-pink-400 shrink-0" />
              <span>
                <strong className="text-white">{OPERATOR_LEGAL_STATEMENT}</strong> Operating inquiries: {OPERATOR_ADDRESS_PLACEHOLDER}
              </span>
            </div>
          </div>

          {/* Department Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Privacy & Data Rights */}
            <div className="p-5 rounded-3xl bg-black/40 border border-white/5 space-y-3 hover:border-pink-500/30 transition-all">
              <div className="flex items-center gap-2 font-bold text-white text-base">
                <Shield className="w-5 h-5 text-emerald-400" />
                <h3>Privacy &amp; Data Rights</h3>
              </div>
              <p className="text-xs text-slate-400">
                Inquiries regarding data access, corrections, privacy policy interpretations, or consent withdrawals.
              </p>
              <div className="pt-2 flex items-center justify-between">
                <span className="font-mono text-xs text-pink-300">{PRIVACY_CONTACT_EMAIL}</span>
                <button
                  onClick={() => copyToClipboard(PRIVACY_CONTACT_EMAIL)}
                  className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] font-bold text-white transition-colors cursor-pointer"
                >
                  {copiedEmail === PRIVACY_CONTACT_EMAIL ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            {/* VIP & Billing Assistance */}
            <div className="p-5 rounded-3xl bg-black/40 border border-white/5 space-y-3 hover:border-pink-500/30 transition-all">
              <div className="flex items-center gap-2 font-bold text-white text-base">
                <CreditCard className="w-5 h-5 text-amber-400" />
                <h3>Payments &amp; VIP Billing</h3>
              </div>
              <p className="text-xs text-slate-400">
                Assistance with manual UPI verification, UTR inquiries, payment activation status, and duplicate debit reviews.
              </p>
              <div className="pt-2 flex items-center justify-between">
                <span className="font-mono text-xs text-pink-300">{PAYMENT_SUPPORT_EMAIL}</span>
                <button
                  onClick={() => copyToClipboard(PAYMENT_SUPPORT_EMAIL)}
                  className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] font-bold text-white transition-colors cursor-pointer"
                >
                  {copiedEmail === PAYMENT_SUPPORT_EMAIL ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Safety & Abuse Reporting */}
            <div className="p-5 rounded-3xl bg-black/40 border border-white/5 space-y-3 hover:border-pink-500/30 transition-all">
              <div className="flex items-center gap-2 font-bold text-white text-base">
                <AlertOctagon className="w-5 h-5 text-rose-400" />
                <h3>Safety &amp; Abuse Reports</h3>
              </div>
              <p className="text-xs text-slate-400">
                Reports of harassment, prohibited content, underage users, or terms violations requiring urgent moderation.
              </p>
              <div className="pt-2 flex items-center justify-between">
                <span className="font-mono text-xs text-pink-300">{ABUSE_REPORT_EMAIL}</span>
                <button
                  onClick={() => copyToClipboard(ABUSE_REPORT_EMAIL)}
                  className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] font-bold text-white transition-colors cursor-pointer"
                >
                  {copiedEmail === ABUSE_REPORT_EMAIL ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            {/* General Technical Support */}
            <div className="p-5 rounded-3xl bg-black/40 border border-white/5 space-y-3 hover:border-pink-500/30 transition-all">
              <div className="flex items-center gap-2 font-bold text-white text-base">
                <MessageSquare className="w-5 h-5 text-blue-400" />
                <h3>General Inquiries</h3>
              </div>
              <p className="text-xs text-slate-400">
                General questions regarding account setup, app features, browser compatibility, and feedback.
              </p>
              <div className="pt-2 flex items-center justify-between">
                <span className="font-mono text-xs text-pink-300">{SUPPORT_EMAIL}</span>
                <button
                  onClick={() => copyToClipboard(SUPPORT_EMAIL)}
                  className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] font-bold text-white transition-colors cursor-pointer"
                >
                  {copiedEmail === SUPPORT_EMAIL ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          </div>

          {/* Guidelines & FAQ Link */}
          <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="text-slate-300">
              Looking for community rules or chat safety guidelines?
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/community-guidelines"
                className="text-pink-400 hover:text-white font-bold transition-colors inline-flex items-center gap-1"
              >
                <span>Guidelines</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
              <Link
                href="/safety"
                className="text-pink-400 hover:text-white font-bold transition-colors inline-flex items-center gap-1"
              >
                <span>Safety Center</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          <div className="border-t border-pink-500/20 pt-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <span>© {new Date().getFullYear()} CupidX (cupidxchat.in) • Operated by {OPERATOR_NAME}</span>
            <div className="flex flex-wrap gap-4">
              <Link href="/terms" className="hover:text-pink-400 transition-colors">Terms of Service</Link>
              <Link href="/privacy" className="hover:text-pink-400 transition-colors">Privacy Policy</Link>
              <Link href="/refund" className="hover:text-pink-400 transition-colors">Refund Policy</Link>
              <Link href="/community-guidelines" className="hover:text-pink-400 transition-colors">Guidelines</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
