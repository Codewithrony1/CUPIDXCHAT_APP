'use client';

import React from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Shield,
  Lock,
  Trash2,
  Heart,
  EyeOff,
  Server,
  UserCheck,
  CreditCard,
  Clock,
  Globe,
  Bell,
  Mail,
  Building,
} from 'lucide-react';
import FloatingHearts from '@/components/FloatingHearts';
import {
  OPERATOR_NAME,
  OPERATOR_LEGAL_STATEMENT,
  OPERATOR_ADDRESS_PLACEHOLDER,
  SUPPORT_EMAIL,
  PRIVACY_CONTACT_EMAIL,
  CURRENT_PRIVACY_VERSION,
  PRIVACY_EFFECTIVE_DATE,
  DELETION_LOCK_TTL_HOURS,
} from '@/lib/config/policy';

export default function PrivacyPage() {
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
              <Shield className="w-6 h-6 text-pink-400" />
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">Privacy Policy</h1>
                <p className="text-[11px] text-pink-300/70 font-mono">
                  Version {CURRENT_PRIVACY_VERSION} • Effective: {PRIVACY_EFFECTIVE_DATE}
                </p>
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
          {/* Section A: Who Operates */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-base font-bold text-white">
              <Building className="w-5 h-5 text-pink-400" />
              <h2>A. Who Operates CupidX</h2>
            </div>
            <p className="p-3 rounded-2xl bg-pink-500/10 border border-pink-500/20 text-pink-200">
              <strong className="text-white">{OPERATOR_LEGAL_STATEMENT}</strong> We operate CupidX (cupidxchat.in) with a core commitment to user privacy, clear notice, and data minimization consistent with modern privacy frameworks (such as India&apos;s Digital Personal Data Protection Act principles and GDPR).
            </p>
            <p className="text-[11px] text-slate-400 italic">
              Legal Notice: This policy details actual technical data processing systems. It should be reviewed by qualified legal counsel for organizational compliance in specific jurisdictions.
            </p>
          </section>

          {/* Section B, C, D: What Data, Why, How Used */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-base font-bold text-white">
              <EyeOff className="w-5 h-5 text-purple-400" />
              <h2>B. What Data We Collect &amp; Specific Purposes</h2>
            </div>
            <p>
              CupidX collects only data necessary to provide a safe, functional, and anonymous social chat experience:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-slate-400">
              <li>
                <strong className="text-white">Account &amp; Profile Identity:</strong> Your verified email (managed securely via Clerk), unique @username, public display name, date of birth (collected solely to enforce the 18+ legal age gate), gender tag, and avatar emoji.
              </li>
              <li>
                <strong className="text-white">Ephemeral Chat Messages:</strong> Real-time messages transmitted during random chat sessions. <em>Storage policy:</em> Strictly ephemeral. Messages are held in temporary memory during the active session and are permanently wiped when either participant clicks NEXT or disconnects.
              </li>
              <li>
                <strong className="text-white">Technical Connection Information:</strong> Connection IP address processed automatically by server infrastructure for DDoS protection, rate limiting, and approximate country code estimation (e.g. 🇮🇳 India).
              </li>
              <li>
                <strong className="text-white">VIP Payment Metadata:</strong> User-submitted UPI transaction reference (UTR) and payment screenshot proofs submitted for manual subscription verification.
              </li>
              <li>
                <strong className="text-white">Consent Audit Records:</strong> Authoritative server timestamps logging your acceptance of terms, privacy policies, age verification, and optional communication preferences.
              </li>
            </ul>
          </section>

          {/* Section E, F: Retention Periods & Processors */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-base font-bold text-white">
              <Server className="w-5 h-5 text-blue-400" />
              <h2>C. Data Retention Categories &amp; Third-Party Processors</h2>
            </div>
            <div className="space-y-2">
              <div className="p-3 rounded-2xl bg-black/40 border border-white/5 space-y-1">
                <span className="font-bold text-pink-300 block">Ephemeral Chat Transcripts: Zero Permanent Retention</span>
                <p className="text-[11px] text-slate-400">
                  Transcripts are destroyed upon session end. We do not maintain historical chat logs of stranger conversations.
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-black/40 border border-white/5 space-y-1">
                <span className="font-bold text-pink-300 block">Personal Profile Data: User-Controlled</span>
                <p className="text-[11px] text-slate-400">
                  Retained until you update your profile or permanently delete your account.
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-black/40 border border-white/5 space-y-1">
                <span className="font-bold text-pink-300 block">Statutory Financial Audit Records: 7-Year Accounting Retention</span>
                <p className="text-[11px] text-slate-400">
                  Anonymized payment transaction references (UTR, amount, currency, date) are retained as required by tax regulations, decoupled from deleted personal profile data.
                </p>
              </div>
            </div>
            <p className="text-slate-400 pt-1">
              <strong>Third-Party Infrastructure:</strong> Authentication is handled by <strong>Clerk</strong>. Databases and hosting are deployed on encrypted enterprise cloud infrastructure. We never sell, rent, or trade your data to third-party data brokers.
            </p>
          </section>

          {/* Section G, H, I: User Rights, Deletion, Consent Withdrawal */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-base font-bold text-white">
              <UserCheck className="w-5 h-5 text-emerald-400" />
              <h2>D. User Rights, Consent Withdrawal &amp; Account Deletion</h2>
            </div>
            <p>Under privacy principles, you have complete control over your personal data:</p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-400">
              <li><strong className="text-white">Right to Access &amp; Update:</strong> View and modify your profile, bio, display name, and avatar at any time in Settings.</li>
              <li><strong className="text-white">Withdrawable Marketing Consent:</strong> Toggle optional product announcements ON or OFF at any time via Settings without affecting chat functionality.</li>
              <li><strong className="text-white">Permanent Account Deletion:</strong> Delete your account and all associated profile, matchmaking, and message data permanently in Settings by typing &quot;DELETE&quot;.</li>
            </ul>
          </section>

          {/* Section J, P: Payments & VIP */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-base font-bold text-white">
              <CreditCard className="w-5 h-5 text-amber-400" />
              <h2>E. Payment Processing &amp; Financial Data Privacy</h2>
            </div>
            <p>
              Optional VIP subscriptions (₹29/month, ₹99/3 months, ₹399/year) are processed in India via dynamic UPI QR code scanning and manual verification:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-400">
              <li>You submit a transaction reference (UTR) and payment screenshot. An administrator verifies the payment and activates VIP perks.</li>
              <li><strong className="text-white">No Sensitive Financial Data Stored:</strong> CupidX never collects or stores credit card numbers, debit card numbers, CVVs, netbanking credentials, or UPI PINs.</li>
              <li>Screenshot proofs are stored in protected storage accessible solely to authorized administrators and are deleted upon account removal or verification archiving.</li>
            </ul>
          </section>

          {/* Section K, L: Security & Cookies */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-base font-bold text-white">
              <Lock className="w-5 h-5 text-pink-400" />
              <h2>F. Security Measures &amp; Cookie Usage</h2>
            </div>
            <p>
              All traffic between your browser and our servers is encrypted using modern TLS (HTTPS) and Secure WebSockets (WSS). We use strictly necessary cookies:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-400">
              <li><strong className="text-white">Authentication Token:</strong> Secure HTTP-only cookies (<code className="text-pink-300">token</code>, Clerk session cookies) maintaining your logged-in state.</li>
              <li><strong className="text-white">Local Preferences:</strong> Storage of your UI theme preference (light/dark/system). We do not use third-party tracking cookies or ad network beacons.</li>
            </ul>
          </section>

          {/* Section M, N, O: IP Processing & Country Isolation */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-base font-bold text-white">
              <Globe className="w-5 h-5 text-blue-400" />
              <h2>G. IP Address Processing &amp; Country Badge Isolation</h2>
            </div>
            <p>
              When connecting to CupidX, your IP address is processed server-side solely to detect your approximate country code (e.g. 🇮🇳 India) to display a country badge to your random partner.
            </p>
            <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-200">
              <strong>Partner Isolation Guarantee:</strong> Your raw IP address is <strong>NEVER</strong> shared with or exposed to your chat partner. We do not track GPS coordinates, latitude, longitude, or street addresses. Multiple users sharing a public IP (e.g. university or coffee shop) are treated as distinct independent accounts.
            </div>
          </section>

          {/* Section Q, R, S: 48-Hour Re-Registration Cooldown */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-base font-bold text-white">
              <Clock className="w-5 h-5 text-amber-400" />
              <h2>H. 48-Hour Re-Registration Restriction (Anti-Abuse Tombstone)</h2>
            </div>
            <p>
              When an account is deleted, a temporary security tombstone is generated:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-400">
              <li><strong className="text-white">Purpose:</strong> Product security and abuse prevention — specifically preventing immediate re-registration churn, harassment evasion, and bot creation.</li>
              <li><strong className="text-white">Privacy-Safe Hash:</strong> We do <strong>NOT</strong> retain your raw email address in this table. Instead, a salted one-way HMAC-SHA256 hash (<code className="text-pink-300">HMAC-SHA256(email, secret)</code>) is stored.</li>
              <li><strong className="text-white">Automatic Expiration:</strong> The tombstone expires automatically after exactly <strong className="text-white">{DELETION_LOCK_TTL_HOURS} hours</strong>. Once expired, the same email identity is fully permitted to create a new CupidX account without requiring manual admin intervention.</li>
            </ul>
          </section>

          {/* Section T: Contact & Grievance */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-base font-bold text-white">
              <Mail className="w-5 h-5 text-pink-400" />
              <h2>I. Privacy Inquiries, Grievances &amp; Contact Channels</h2>
            </div>
            <p>
              For privacy requests, data erasure inquiries, or grievances, reach out directly to our privacy desk:
            </p>
            <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-1 font-mono text-xs">
              <div>Operator: <strong className="text-white">{OPERATOR_NAME}</strong></div>
              <div>Privacy &amp; Data Rights: <strong className="text-pink-300">{PRIVACY_CONTACT_EMAIL}</strong></div>
              <div>General Support: <strong className="text-pink-300">{SUPPORT_EMAIL}</strong></div>
              <div>Operating Address: <span className="text-slate-400">{OPERATOR_ADDRESS_PLACEHOLDER}</span></div>
            </div>
          </section>

          <div className="border-t border-pink-500/20 pt-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <span>© {new Date().getFullYear()} CupidX (cupidxchat.in) • Operated by {OPERATOR_NAME}</span>
            <div className="flex flex-wrap gap-4">
              <Link href="/terms" className="hover:text-pink-400 transition-colors">Terms of Service</Link>
              <Link href="/refund" className="hover:text-pink-400 transition-colors">Refund Policy</Link>
              <Link href="/community-guidelines" className="hover:text-pink-400 transition-colors">Guidelines</Link>
              <Link href="/contact" className="hover:text-pink-400 transition-colors">Contact</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
