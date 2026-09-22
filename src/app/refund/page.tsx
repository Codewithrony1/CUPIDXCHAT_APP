'use client';

import React from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Heart,
  RefreshCw,
  Mail,
  Shield,
  Clock,
  HelpCircle,
} from 'lucide-react';
import FloatingHearts from '@/components/FloatingHearts';
import {
  OPERATOR_NAME,
  OPERATOR_LEGAL_STATEMENT,
  PAYMENT_SUPPORT_EMAIL,
  SUPPORT_EMAIL,
  CURRENT_REFUND_VERSION,
  REFUND_EFFECTIVE_DATE,
} from '@/lib/config/policy';

export default function RefundPage() {
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
              <CreditCard className="w-6 h-6 text-pink-400" />
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">Refund &amp; Cancellation Policy</h1>
                <p className="text-[11px] text-pink-300/70 font-mono">
                  Version {CURRENT_REFUND_VERSION} • Effective: {REFUND_EFFECTIVE_DATE}
                </p>
              </div>
            </div>
          </div>
          <Link href="/" className="flex items-center space-x-1.5 text-sm font-bold text-pink-300">
            <Heart className="w-4 h-4 text-pink-500 fill-pink-500" />
            <span>CupidX</span>
          </Link>
        </div>

        {/* Main Content */}
        <div className="rounded-3xl bg-[#11001c]/90 border border-pink-500/20 p-6 sm:p-8 space-y-8 text-xs sm:text-sm text-slate-300 leading-relaxed shadow-2xl backdrop-blur-md">
          {/* Section 1: Overview & Digital Nature */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-base font-bold text-white">
              <Shield className="w-5 h-5 text-pink-400" />
              <h2>1. Nature of Digital VIP Services</h2>
            </div>
            <p>
              CupidX offers optional premium memberships (&quot;VIP&quot;) granting instant digital features such as in-chat media sharing, priority matching, and exclusive avatar customization.
            </p>
            <p className="p-3 rounded-2xl bg-pink-500/10 border border-pink-500/20 text-pink-200">
              <strong className="text-white">{OPERATOR_LEGAL_STATEMENT}</strong> Because VIP privileges are intangible, immediately accessible digital services that activate upon administrative verification of your payment, <strong className="text-white">all VIP purchases are final and non-refundable once activated</strong>, except under the explicit dispute resolution scenarios outlined below.
            </p>
          </section>

          {/* Section 2: Payment Verification Protocol */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-base font-bold text-white">
              <RefreshCw className="w-5 h-5 text-purple-400" />
              <h2>2. Payment Verification &amp; Processing (UPI / QR)</h2>
            </div>
            <p>
              In India, subscriptions are priced at <strong className="text-white">₹29 (1 Month)</strong>, <strong className="text-white">₹99 (3 Months)</strong>, and <strong className="text-white">₹399 (1 Year)</strong>.
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-400">
              <li>Payments are initiated by scanning a dynamic UPI QR code and submitting the corresponding 12-digit transaction reference (UTR) and screenshot proof.</li>
              <li>Subscriptions typically activate within a short review window following verification.</li>
              <li>CupidX does not operate automated recurring auto-debit on manual UPI payments; memberships naturally expire at the conclusion of the purchased term unless renewed by the user.</li>
            </ul>
          </section>

          {/* Section 3: Eligible Refund Scenarios */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-base font-bold text-white">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              <h2>3. Exceptions: Duplicate &amp; Uncredited Transactions</h2>
            </div>
            <p>
              Refunds or credit adjustments are considered solely under the following verified technical conditions:
            </p>
            <div className="space-y-2">
              <div className="p-3 rounded-2xl bg-black/40 border border-white/5 space-y-1">
                <span className="font-bold text-amber-300 block">A. Duplicate Payments</span>
                <p className="text-[11px] text-slate-400">
                  If your bank or UPI app debited your account twice for a single VIP subscription order, provide both UTR numbers within 48 hours. Upon verification with our merchant records, the duplicate debit will be refunded to the originating source.
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-black/40 border border-white/5 space-y-1">
                <span className="font-bold text-amber-300 block">B. Uncredited Verified Payment</span>
                <p className="text-[11px] text-slate-400">
                  If funds were successfully debited from your bank account and settled to our UPI merchant account, but VIP was not activated within 48 hours due to a technical matching delay, we will either manually activate your full subscription period or issue a refund.
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-black/40 border border-white/5 space-y-1">
                <span className="font-bold text-amber-300 block">C. Failed Bank Transfers</span>
                <p className="text-[11px] text-slate-400">
                  If your UPI app displays a &quot;Transaction Failed&quot; or &quot;Pending&quot; status and the funds did not reach our merchant account, the funds are held by the intermediary banking network and are typically reversed to your account by your issuing bank within 3 to 5 business days under standard NPCI guidelines.
                </p>
              </div>
            </div>
          </section>

          {/* Section 4: Account Deletion & Active VIP */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-base font-bold text-white">
              <Clock className="w-5 h-5 text-rose-400" />
              <h2>4. Account Deletion &amp; VIP Forfeiture</h2>
            </div>
            <p>
              If you choose to permanently delete your CupidX account via Settings while holding an active VIP membership:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-400">
              <li>Your VIP benefits and remaining subscription days are immediately and irrevocably forfeited.</li>
              <li>Voluntary account deletion does not qualify for a pro-rata or full refund.</li>
              <li>As explained prior to confirming deletion, deleting your account terminates all privileges immediately.</li>
            </ul>
          </section>

          {/* Section 5: Chargebacks & Dispute Protocol */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-base font-bold text-white">
              <HelpCircle className="w-5 h-5 text-blue-400" />
              <h2>5. Dispute Resolution &amp; Payment Support</h2>
            </div>
            <p>
              Before initiating a formal banking dispute or chargeback, please contact our billing support desk directly. Most payment discrepancies are resolved rapidly upon verification of your UTR number.
            </p>
            <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-1 font-mono text-xs">
              <div>Billing Assistance: <strong className="text-pink-300">{PAYMENT_SUPPORT_EMAIL}</strong></div>
              <div>General Support: <strong className="text-pink-300">{SUPPORT_EMAIL}</strong></div>
              <div>Required Information: <span className="text-slate-400">Your @username, Order ID, 12-digit UPI UTR, and Bank Debit Timestamp.</span></div>
            </div>
          </section>

          <div className="border-t border-pink-500/20 pt-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <span>© {new Date().getFullYear()} CupidX (cupidxchat.in) • Operated by {OPERATOR_NAME}</span>
            <div className="flex flex-wrap gap-4">
              <Link href="/terms" className="hover:text-pink-400 transition-colors">Terms of Service</Link>
              <Link href="/privacy" className="hover:text-pink-400 transition-colors">Privacy Policy</Link>
              <Link href="/community-guidelines" className="hover:text-pink-400 transition-colors">Guidelines</Link>
              <Link href="/contact" className="hover:text-pink-400 transition-colors">Contact</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
