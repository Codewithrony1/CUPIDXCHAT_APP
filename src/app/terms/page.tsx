'use client';

import React from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Shield,
  FileText,
  AlertOctagon,
  Heart,
  Lock,
  HelpCircle,
  CreditCard,
  Trash2,
  Scale,
  RefreshCw,
  Mail,
  Building,
} from 'lucide-react';
import FloatingHearts from '@/components/FloatingHearts';
import {
  OPERATOR_NAME,
  OPERATOR_LEGAL_STATEMENT,
  OPERATOR_ADDRESS_PLACEHOLDER,
  SUPPORT_EMAIL,
  CURRENT_TERMS_VERSION,
  TERMS_EFFECTIVE_DATE,
  MINIMUM_LEGAL_AGE,
} from '@/lib/config/policy';

export default function TermsPage() {
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
              <FileText className="w-6 h-6 text-pink-400" />
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">Terms of Service</h1>
                <p className="text-[11px] text-pink-300/70 font-mono">
                  Version {CURRENT_TERMS_VERSION} • Effective: {TERMS_EFFECTIVE_DATE}
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
          {/* Section 1 & 2: About & Operator */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-base font-bold text-white">
              <Building className="w-5 h-5 text-pink-400" />
              <h2>1. About CupidX &amp; Operator Identification</h2>
            </div>
            <p>
              CupidXChat (accessible at <strong className="text-white">cupidxchat.in</strong>) is an online real-time social platform designed for spontaneous, ephemeral 1-to-1 conversations.
            </p>
            <p className="p-3 rounded-2xl bg-pink-500/10 border border-pink-500/20 text-pink-200">
              <strong className="text-white">{OPERATOR_LEGAL_STATEMENT}</strong> All references to &quot;CupidX&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot; refer to the operator {OPERATOR_NAME}. Note: This operational declaration specifies product stewardship and does not constitute an unverified corporate or limited liability entity assertion.
            </p>
          </section>

          {/* Section 3 & 4: Eligibility & Registration */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-base font-bold text-white">
              <Shield className="w-5 h-5 text-pink-400" />
              <h2>2. Eligibility &amp; Minimum Legal Age ({MINIMUM_LEGAL_AGE}+)</h2>
            </div>
            <p>
              You must be at least <strong className="text-white">{MINIMUM_LEGAL_AGE} years of age</strong> (or the legal age of majority in your jurisdiction) to access or use CupidX. By accessing the site or creating an account, you affirm that you are 18 or older and fully competent to enter into these Terms. We enforce strict server-side date-of-birth verification; minors are barred from registration.
            </p>
          </section>

          {/* Section 5, 6, 7: Auth, Profile & Stranger Chat */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-base font-bold text-white">
              <Lock className="w-5 h-5 text-purple-400" />
              <h2>3. Clerk Authentication, Profile &amp; Random Stranger Chat Nature</h2>
            </div>
            <p>
              User authentication is powered exclusively by <strong className="text-white">Clerk</strong>. You are responsible for safeguarding your credentials. During onboarding, you configure a public profile containing your display name, gender tag, age, and avatar emoji.
            </p>
            <p className="p-3 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-200">
              <strong>Stranger Chat Nature:</strong> You acknowledge that CupidX connects unacquainted users for ephemeral conversations. We do not perform background checks on users. You should exercise sound judgment and never share financial credentials, home addresses, government IDs, or sensitive secrets with unknown strangers.
            </p>
          </section>

          {/* Section 8-15: Content, Prohibited Conduct, Harassment */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-base font-bold text-white">
              <AlertOctagon className="w-5 h-5 text-rose-400" />
              <h2>4. Acceptable Use, Prohibited Conduct &amp; Zero Tolerance Rules</h2>
            </div>
            <p>
              All members must treat others with dignity and respect. The following behaviors are strictly prohibited:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-400">
              <li><strong className="text-rose-300">Zero Tolerance for CSAM:</strong> Child sexual abuse material, child exploitation, or sexualization of minors results in immediate permanent ban and immediate reporting to legal authorities.</li>
              <li><strong className="text-rose-300">Harassment &amp; Threats:</strong> Bullying, intimidation, stalking, blackmail, extortion, hate speech, or incitement of violence.</li>
              <li><strong className="text-rose-300">Non-Consensual Imagery:</strong> Transmitting non-consensual sexually explicit media, nude photos, or personal doxxing data.</li>
              <li><strong className="text-rose-300">Spam, Bots &amp; Phishing:</strong> Unsolicited advertising, affiliate links, automated bot scripts, or phishing malware.</li>
              <li><strong className="text-rose-300">Impersonation:</strong> Pretending to be platform moderators, administrators, or other real individuals.</li>
              <li><strong className="text-rose-300">Unlawful Activity:</strong> Solicitation of illegal substances, prostitution, money laundering, or illegal trade.</li>
            </ul>
          </section>

          {/* Section 16, 17, 18: Reporting, Moderation & Suspension */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-base font-bold text-white">
              <Shield className="w-5 h-5 text-blue-400" />
              <h2>5. Reporting, Blocking &amp; Platform Moderation</h2>
            </div>
            <p>
              Users may immediately disconnect from any chat partner by clicking NEXT, or utilize in-chat tools to report abuse or block users. We reserve the authoritative right to investigate complaints, terminate sessions, revoke VIP privileges, and permanently suspend accounts violating these standards.
            </p>
          </section>

          {/* Section 19-24: VIP Memberships, Payments, Pricing & Refunds */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-base font-bold text-white">
              <CreditCard className="w-5 h-5 text-amber-400" />
              <h2>6. VIP Subscriptions, Payment Processing &amp; Refund Terms</h2>
            </div>
            <p>
              CupidX offers optional VIP subscriptions granting benefits such as image sharing and custom avatars.
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-400">
              <li><strong className="text-white">India Pricing &amp; Methods:</strong> Monthly (₹29), 3 Months (₹99), Yearly (₹399). Payments are handled via manual UPI QR code scanning. Users submit their transaction reference (UTR) and proof screenshot for administrative review and activation.</li>
              <li><strong className="text-white">International Pricing:</strong> Monthly ($2) and Yearly ($12) via cryptocurrency/digital payment references.</li>
              <li><strong className="text-white">No Raw Card Storage:</strong> CupidX does not receive, process, or store credit card numbers, debit card numbers, CVVs, banking passwords, or UPI PINs.</li>
              <li><strong className="text-white">Refund Policy:</strong> VIP subscriptions are digital services that activate upon verification. All purchases are final and non-refundable once activated, except for verified duplicate transactions reported within 48 hours. See our full <Link href="/refund" className="text-pink-400 underline">Refund Policy</Link>.</li>
            </ul>
          </section>

          {/* Section 25, 26, 27, 28: Platform Availability, Deletion & Retention */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-base font-bold text-white">
              <Trash2 className="w-5 h-5 text-rose-400" />
              <h2>7. Account Deletion, 48-Hour Cooldown &amp; Data Retention</h2>
            </div>
            <p>
              You maintain autonomy over your account and may permanently delete your account and personal data at any time via Settings &gt; Account Management by typing &quot;DELETE&quot;.
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-400">
              <li><strong className="text-white">Immediate Effects:</strong> Deletion instantly terminates live chat sessions, clears matchmaking queues, and wipes your profile and chat messages.</li>
              <li><strong className="text-white">Active VIP Forfeiture:</strong> Deleting an account with an active VIP subscription forfeits remaining VIP access without automatic refund.</li>
              <li><strong className="text-white">Statutory Financial Retention:</strong> Basic transaction references (UTR, amount, currency, date) are preserved in an anonymized financial audit log solely for statutory accounting, tax, and dispute reconciliation.</li>
              <li><strong className="text-white">48-Hour Re-Registration Cooldown:</strong> To prevent immediate ban evasion, harassment, and bot churn, a minimal cryptographic hash (HMAC-SHA256) of your verified email is temporarily retained for 48 hours. Your raw email is not stored, and the restriction expires automatically after 48 hours.</li>
            </ul>
          </section>

          {/* Section 29, 30: IP & Third Party Services */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-base font-bold text-white">
              <Scale className="w-5 h-5 text-emerald-400" />
              <h2>8. Intellectual Property &amp; Third-Party Services</h2>
            </div>
            <p>
              The CupidX visual design, branding, code, and logos belong exclusively to {OPERATOR_NAME}. We integrate trusted infrastructure partners (Clerk for authentication and cloud database services). You grant CupidX a non-exclusive license to transmit user content solely as necessary to operate the ephemeral communication service.
            </p>
          </section>

          {/* Section 31, 32: Limitation of Liability & Governing Law */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-base font-bold text-white">
              <HelpCircle className="w-5 h-5 text-blue-400" />
              <h2>9. Limitation of Liability &amp; Governing Law</h2>
            </div>
            <p>
              CupidX is provided on an &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; basis without warranties of any kind. To the maximum extent permitted by applicable law, {OPERATOR_NAME} disclaims liability for any indirect, consequential, or punitive damages arising from platform usage or interactions between users. These Terms are governed by applicable local laws, and disputes are subject to the competent courts of the operator&apos;s operating jurisdiction.
            </p>
          </section>

          {/* Section 33, 34: Contact & Policy Updates */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-base font-bold text-white">
              <Mail className="w-5 h-5 text-pink-400" />
              <h2>10. Contact Information &amp; Policy Modifications</h2>
            </div>
            <p>
              We may update these Terms periodically. Continued platform usage after published updates constitutes binding acceptance. For legal or policy inquiries, contact our team:
            </p>
            <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-1 font-mono text-xs">
              <div>Operator: <strong className="text-white">{OPERATOR_NAME}</strong></div>
              <div>General Support: <strong className="text-pink-300">{SUPPORT_EMAIL}</strong></div>
              <div>Address: <span className="text-slate-400">{OPERATOR_ADDRESS_PLACEHOLDER}</span></div>
            </div>
          </section>

          <div className="border-t border-pink-500/20 pt-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <span>© {new Date().getFullYear()} CupidX (cupidxchat.in) • Operated by {OPERATOR_NAME}</span>
            <div className="flex flex-wrap gap-4">
              <Link href="/privacy" className="hover:text-pink-400 transition-colors">Privacy Policy</Link>
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
