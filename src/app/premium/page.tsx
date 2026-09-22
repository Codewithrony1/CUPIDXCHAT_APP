'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Crown,
  Sparkles,
  ArrowLeft,
  UserCheck,
  Camera,
  Copy,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Loader2,
  History,
  CreditCard,
  Zap,
  ShieldCheck,
  RefreshCw,
  X,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import AppShell from '@/components/AppShell';
import confetti from 'canvas-confetti';

interface PaymentHistoryItem {
  id: string;
  requestId: string;
  paymentId?: string | null;
  amount: number;
  currency: string;
  plan: string;
  region: string;
  status: string;
  rejectionReason?: string | null;
  screenshotUrl?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
}

export default function PremiumPage() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();

  // Plan Selection: Monthly (₹29), 3 Months (₹99), Yearly (₹399)
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | '3months' | 'yearly'>('monthly');

  // Dynamic QR & Pricing Settings
  const [pricing, setPricing] = useState({
    monthly: 29,
    threeMonths: 99,
    yearly: 399,
    merchantUpiId: 'sumitpornsware@fam',
    merchantName: 'CupidX Chat',
    qrMonthly: '/uploads/qr/payment-qr-india.jpg',
    qrThreeMonths: '/uploads/qr/payment-qr-india.jpg',
    qrYearly: '/uploads/qr/payment-qr-india-yearly.jpg',
  });

  const [copiedUpi, setCopiedUpi] = useState<boolean>(false);

  // Form Inputs
  const [utrNumber, setUtrNumber] = useState<string>('');
  const [screenshotData, setScreenshotData] = useState<string | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Submission & Status State
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [activeRequest, setActiveRequest] = useState<any | null>(null);

  // Payment History
  const [history, setHistory] = useState<PaymentHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [selectedFullImage, setSelectedFullImage] = useState<string | null>(null);

  const isVIP = user?.membershipTier === 'VIP' || (user?.subscription?.isActive === true && user?.subscription?.plan === 'VIP');
  const vipExpiryDate = user?.vip_expires_at
    ? new Date(user.vip_expires_at)
    : (user?.subscription?.endDate ? new Date(user.subscription.endDate) : null);
  const isVipActive = isVIP && (!vipExpiryDate || vipExpiryDate.getTime() > Date.now());

  // Compute Active Price & UPI String
  const activeAmount = selectedPlan === 'yearly' ? pricing.yearly : (selectedPlan === '3months' ? pricing.threeMonths : pricing.monthly);
  const planLabel = selectedPlan === 'yearly' ? `Yearly (₹${pricing.yearly})` : (selectedPlan === '3months' ? `3 Months (₹${pricing.threeMonths})` : `Monthly (₹${pricing.monthly})`);
  const upiPayUri = `upi://pay?pa=${pricing.merchantUpiId}&pn=${encodeURIComponent(pricing.merchantName)}&am=${activeAmount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`CupidX VIP ${planLabel}`)}`;
  const staticQrUrl = selectedPlan === 'monthly' ? pricing.qrMonthly : (selectedPlan === '3months' ? pricing.qrThreeMonths : pricing.qrYearly);
  const dynamicQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(upiPayUri)}`;

  // Fetch Pricing & QR Settings
  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/payment/qr');
      if (res.ok) {
        const data = await res.json();
        if (data.pricing?.india) {
          setPricing({
            monthly: data.pricing.india.monthly || 29,
            threeMonths: data.pricing.india.threeMonths || 99,
            yearly: data.pricing.india.yearly || 399,
            merchantUpiId: data.merchantUpiId || 'sumitpornsware@fam',
            merchantName: data.merchantName || 'CupidX Chat',
            qrMonthly: data.pricing.india.qrMonthly || '/uploads/qr/payment-qr-india.jpg',
            qrThreeMonths: data.pricing.india.qrThreeMonths || '/uploads/qr/payment-qr-india.jpg',
            qrYearly: data.pricing.india.qrYearly || '/uploads/qr/payment-qr-india-yearly.jpg',
          });
        }
      }
    } catch (e) {
      console.warn('Failed to load pricing config:', e);
    }
  };

  // Fetch User Active Status
  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/payment/my-status');
      if (res.ok) {
        const data = await res.json();
        if (data.request) {
          setActiveRequest(data.request);
          if (data.request.status === 'APPROVED' || data.request.status === 'approved') {
            refreshUser();
          }
        }
      }
    } catch (e) {
      console.warn('Failed to fetch status:', e);
    }
  };

  // Fetch Payment History
  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch('/api/payments/history');
      if (res.ok) {
        const data = await res.json();
        setHistory(data.payments || []);
      }
    } catch (e) {
      console.warn('Failed to fetch history:', e);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchStatus();
    fetchHistory();
  }, []);

  // Poll status while there is an active review
  useEffect(() => {
    if (!activeRequest || (activeRequest.status !== 'UNDER_REVIEW' && activeRequest.status !== 'pending')) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/payment/my-status');
        if (res.ok) {
          const data = await res.json();
          if (data.request) {
            setActiveRequest(data.request);

            if (data.request.status === 'APPROVED' || data.request.status === 'approved') {
              try {
                confetti({
                  particleCount: 150,
                  spread: 80,
                  origin: { y: 0.6 },
                });
              } catch (e) {}

              await refreshUser();
              fetchHistory();
              clearInterval(interval);
            }
          }
        }
      } catch (err) {
        console.warn('Status poll error:', err);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [activeRequest?.status]);

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(pricing.merchantUpiId);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('Screenshot file size cannot exceed 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setScreenshotPreview(result);
      setScreenshotData(result);
      setErrorMessage('');
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const cleanUtr = utrNumber.trim();
    if (!cleanUtr && !screenshotData) {
      setErrorMessage('Please provide either your 12-digit UPI UTR number or upload a payment screenshot.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/payment/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: selectedPlan,
          region: 'india',
          paymentId: cleanUtr,
          screenshot: screenshotData,
        }),
      });

      const data = await res.json();
      if (res.ok && data.request) {
        setActiveRequest(data.request);
        setSuccessMessage('Payment submitted successfully! Our team is verifying your payment.');
        setUtrNumber('');
        setScreenshotData(null);
        setScreenshotPreview(null);
        fetchHistory();
      } else {
        setErrorMessage(data.error || 'Failed to submit payment. Please try again.');
      }
    } catch (err) {
      console.error(err);
      setErrorMessage('Network error submitting payment. Please check your connection.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell>
      <div className="min-h-screen bg-[#070010] text-slate-100 pb-24 pt-4 px-3 sm:px-4 max-w-2xl mx-auto space-y-6 font-sans">
        
        {/* TOP BAR */}
        <div className="flex items-center justify-between">
          <Link
            href="/dashboard"
            className="p-2 rounded-2xl bg-white/5 hover:bg-white/10 text-pink-300 hover:text-white transition-colors border border-pink-500/20"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center space-x-2">
            <Crown className="w-5 h-5 text-yellow-400 fill-current animate-pulse" />
            <span className="font-black text-sm tracking-wider uppercase bg-gradient-to-r from-yellow-300 via-amber-300 to-yellow-500 bg-clip-text text-transparent">
              CupidX Premium
            </span>
          </div>
          <button
            onClick={() => {
              fetchSettings();
              fetchStatus();
              fetchHistory();
            }}
            className="p-2 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors border border-white/10"
            title="Refresh status"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* 1. MEMBERSHIP STATUS BANNER */}
        <div className="rounded-3xl bg-gradient-to-r from-pink-950/40 via-purple-950/40 to-slate-900/60 p-5 border border-pink-500/30 backdrop-blur-xl shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3.5">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${
                isVipActive
                  ? 'bg-gradient-to-tr from-yellow-400 to-amber-500 text-slate-950 shadow-yellow-500/30'
                  : 'bg-white/10 text-slate-400 border border-white/10'
              }`}>
                <Crown className={`w-6 h-6 ${isVipActive ? 'fill-current' : ''}`} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-black text-white">
                    {isVipActive ? 'CupidX VIP Active' : 'Free Member'}
                  </h2>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    isVipActive
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-white/10 text-slate-400 border border-white/15'
                  }`}>
                    {isVipActive ? 'ACTIVE ✨' : 'FREE'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {isVipActive && vipExpiryDate
                    ? `Pass expires on ${vipExpiryDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
                    : 'Upgrade to enjoy unlimited filtered matches and golden perks'}
                </p>
              </div>
            </div>

            {isVipActive && (
              <span className="hidden sm:inline-block px-3 py-1 rounded-xl bg-yellow-400/10 text-yellow-300 border border-yellow-400/30 text-xs font-bold">
                👑 VIP Pass
              </span>
            )}
          </div>
        </div>

        {/* 2. ACTIVE REVIEW / PENDING CARD */}
        {activeRequest && (activeRequest.status === 'UNDER_REVIEW' || activeRequest.status === 'pending') && (
          <div className="p-5 rounded-3xl bg-amber-500/10 border-2 border-amber-500/40 backdrop-blur-xl shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
                </span>
                <h3 className="text-xs font-black uppercase text-amber-300 tracking-wider">
                  Payment Under Review
                </h3>
              </div>
              <span className="font-mono text-[11px] font-bold text-yellow-400 bg-black/40 px-2 py-0.5 rounded border border-yellow-400/20">
                {activeRequest.requestId}
              </span>
            </div>

            <p className="text-xs text-amber-200/90 leading-relaxed">
              We received your payment submission for <strong className="text-white capitalize">{activeRequest.plan} (₹{activeRequest.amount})</strong>. 
              Our administration verifies payments in real time. Your VIP pass will automatically activate once confirmed!
            </p>

            <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-amber-500/20 font-mono text-slate-300">
              {activeRequest.paymentId && (
                <div>
                  <span className="text-slate-400 block text-[9px] uppercase font-bold">UTR Reference:</span>
                  <span className="text-yellow-300 font-bold">{activeRequest.paymentId}</span>
                </div>
              )}
              <div>
                <span className="text-slate-400 block text-[9px] uppercase font-bold">Submitted:</span>
                <span>{new Date(activeRequest.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          </div>
        )}

        {/* 3. REJECTION ALERT */}
        {activeRequest && (activeRequest.status === 'REJECTED' || activeRequest.status === 'rejected') && (
          <div className="p-4 rounded-3xl bg-rose-500/15 border-2 border-rose-500/40 backdrop-blur-xl shadow-xl space-y-2">
            <div className="flex items-center space-x-2 text-rose-400">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <h4 className="text-xs font-black uppercase tracking-wider">Verification Failed</h4>
            </div>
            <p className="text-xs text-rose-200">
              <strong className="text-white">Reason:</strong> {activeRequest.rejectionReason || 'UTR did not match or transaction was not received.'}
            </p>
            <p className="text-[11px] text-slate-300">
              Please verify your transaction in your UPI app and submit your correct 12-digit UTR below.
            </p>
          </div>
        )}

        {/* 4. CHOOSE YOUR PREMIUM PLAN */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-pink-400" />
              <span>Select Your Plan</span>
            </h3>
            <span className="text-[11px] text-pink-300 font-bold">100% Secure UPI</span>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            {/* Monthly Plan */}
            <div
              onClick={() => setSelectedPlan('monthly')}
              className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer relative ${
                selectedPlan === 'monthly'
                  ? 'bg-gradient-to-b from-pink-500/20 to-purple-600/20 border-pink-500 shadow-lg shadow-pink-500/20 text-white'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400'
              }`}
            >
              <span className="text-[10px] font-black uppercase tracking-wider block text-pink-300">Monthly</span>
              <div className="flex items-baseline space-x-0.5 my-1">
                <span className="text-xl font-black text-white">₹{pricing.monthly}</span>
                <span className="text-[10px] text-slate-400">/ 30d</span>
              </div>
              <p className="text-[10px] text-slate-400">₹0.96/day</p>
            </div>

            {/* 3 Months Plan (Most Popular) */}
            <div
              onClick={() => setSelectedPlan('3months')}
              className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer relative ${
                selectedPlan === '3months'
                  ? 'bg-gradient-to-b from-pink-500/20 to-purple-600/20 border-pink-500 shadow-xl shadow-pink-500/30 text-white'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400'
              }`}
            >
              <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 text-[8px] font-black text-white uppercase tracking-wider whitespace-nowrap shadow-md">
                Popular
              </span>
              <span className="text-[10px] font-black uppercase tracking-wider block text-purple-300">3 Months</span>
              <div className="flex items-baseline space-x-0.5 my-1">
                <span className="text-xl font-black text-white">₹{pricing.threeMonths}</span>
                <span className="text-[10px] text-slate-400">/ 90d</span>
              </div>
              <p className="text-[10px] text-slate-400">Save 40%</p>
            </div>

            {/* Yearly Plan (Best Value) */}
            <div
              onClick={() => setSelectedPlan('yearly')}
              className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer relative ${
                selectedPlan === 'yearly'
                  ? 'bg-gradient-to-b from-yellow-500/20 to-amber-600/20 border-yellow-400 shadow-xl shadow-yellow-500/20 text-white'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400'
              }`}
            >
              <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 text-[8px] font-black text-slate-950 uppercase tracking-wider whitespace-nowrap shadow-md">
                Best Value
              </span>
              <span className="text-[10px] font-black uppercase tracking-wider block text-yellow-400">Yearly</span>
              <div className="flex items-baseline space-x-0.5 my-1">
                <span className="text-xl font-black text-white">₹{pricing.yearly}</span>
                <span className="text-[10px] text-slate-400">/ 365d</span>
              </div>
              <p className="text-[10px] text-yellow-300/80">Save 65%</p>
            </div>
          </div>
        </div>

        {/* 5. PAYMENT INSTRUCTIONS & DYNAMIC QR */}
        <div className="rounded-3xl bg-slate-900/70 border border-pink-500/20 p-5 space-y-4 backdrop-blur-xl shadow-xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div>
              <h4 className="text-xs font-black text-white uppercase tracking-wider">
                Step 1: Scan & Pay ₹{activeAmount}
              </h4>
              <p className="text-[11px] text-slate-400">
                Scan via Google Pay, PhonePe, Paytm, BHIM, or any UPI app
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-xl bg-pink-500/10 text-pink-300 text-[10px] font-extrabold border border-pink-500/20">
              UPI Instant
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-5 pt-1">
            {/* Dynamic QR Box */}
            <div className="relative w-44 h-44 shrink-0 bg-white p-2 rounded-2xl shadow-xl shadow-pink-500/20 border-2 border-pink-500/30 flex items-center justify-center">
              <img
                src={staticQrUrl}
                alt="CupidX UPI Payment QR"
                className="w-full h-full object-contain rounded-xl"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = dynamicQrUrl;
                }}
              />
            </div>

            {/* Instructions & Copy UPI ID */}
            <div className="space-y-3 w-full text-left">
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Admin Official UPI ID</span>
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/50 border border-white/10">
                  <span className="font-mono text-xs font-bold text-yellow-400 truncate select-all">
                    {pricing.merchantUpiId}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyUpi}
                    className="px-2.5 py-1 rounded-lg bg-pink-500/20 text-pink-300 hover:bg-pink-500/30 text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer shrink-0 ml-2"
                  >
                    <Copy className="w-3 h-3" />
                    <span>{copiedUpi ? 'Copied! ✓' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {/* Direct App Link for mobile devices */}
              <a
                href={upiPayUri}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-pink-500/20 transition-all active:scale-[0.98]"
              >
                <span>Tap to Pay on UPI App (₹{activeAmount})</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <p className="text-[10px] text-slate-400 leading-tight">
                💡 After paying, copy the <strong>12-digit UTR / Reference ID</strong> from your UPI app receipt and submit below.
              </p>
            </div>
          </div>
        </div>

        {/* 6. SUBMISSION FORM */}
        <form onSubmit={handleSubmit} className="rounded-3xl bg-slate-900/70 border border-pink-500/20 p-5 space-y-4 backdrop-blur-xl shadow-xl">
          <div className="border-b border-white/10 pb-3">
            <h4 className="text-xs font-black text-white uppercase tracking-wider">
              Step 2: Submit Verification Details
            </h4>
            <p className="text-[11px] text-slate-400">
              Enter your UTR reference number or attach your payment receipt screenshot
            </p>
          </div>

          {/* UTR Input */}
          <div className="space-y-1.5 text-left">
            <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
              <span>UTR / Transaction Number</span>
              <span className="text-[10px] text-slate-500 font-normal">12-digit number</span>
            </label>
            <input
              type="text"
              placeholder="[ Enter transaction number ]"
              value={utrNumber}
              onChange={(e) => setUtrNumber(e.target.value.replace(/\s+/g, ''))}
              className="w-full px-3.5 py-3 rounded-xl bg-black/60 border border-slate-800 text-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-pink-500/50 uppercase tracking-wider placeholder:normal-case placeholder:font-sans placeholder:text-slate-600"
            />
          </div>

          {/* Screenshot Upload */}
          <div className="space-y-1.5 text-left">
            <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
              <span>Payment Screenshot</span>
              <span className="text-[10px] text-slate-500 font-normal">JPG, PNG, WebP (Max 5MB)</span>
            </label>

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-white/15 hover:border-pink-500 bg-white/[0.02] hover:bg-pink-500/5 rounded-2xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-2"
            >
              {screenshotPreview ? (
                <div className="relative w-full h-32 rounded-xl overflow-hidden border border-white/20 bg-black">
                  <img src={screenshotPreview} alt="Receipt Preview" className="w-full h-full object-contain" />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setScreenshotData(null);
                      setScreenshotPreview(null);
                    }}
                    className="absolute top-2 right-2 p-1 rounded-full bg-black/80 hover:bg-rose-600 text-white transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="w-10 h-10 rounded-2xl bg-pink-500/20 text-pink-400 flex items-center justify-center">
                    <UploadCloud className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-200">Click or drag screenshot here</p>
                    <p className="text-[10px] text-slate-500">Attach payment receipt showing UTR</p>
                  </div>
                </>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* Alert Messages */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center gap-2 text-left">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-2 text-left">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMessage}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-4 rounded-2xl font-black bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white shadow-xl shadow-pink-500/25 text-sm flex items-center justify-center space-x-2 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Submitting Verification...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Submit for VIP Activation</span>
              </>
            )}
          </button>
        </form>

        {/* 7. BENEFITS SHOWCASE */}
        <div className="rounded-3xl bg-slate-900/60 border border-pink-500/20 p-5 space-y-4 backdrop-blur-xl">
          <h3 className="text-sm font-black text-white uppercase tracking-wider border-b border-white/10 pb-3 flex items-center gap-2">
            <Crown className="w-4 h-4 text-yellow-400 fill-yellow-400" />
            <span>All VIP Member Benefits</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="flex items-start space-x-3 p-2.5 rounded-2xl bg-white/[0.02] border border-white/5">
              <div className="w-8 h-8 rounded-xl bg-yellow-500/20 text-yellow-400 flex items-center justify-center shrink-0 border border-yellow-500/30">
                <Crown className="w-4 h-4 fill-current" />
              </div>
              <div>
                <p className="font-extrabold text-white">Golden VIP Profile Badge</p>
                <p className="text-slate-400 text-[11px]">Stand out with the 💎 VIP badge next to your username.</p>
              </div>
            </div>

            <div className="flex items-start space-x-3 p-2.5 rounded-2xl bg-white/[0.02] border border-white/5">
              <div className="w-8 h-8 rounded-xl bg-pink-500/20 text-pink-400 flex items-center justify-center shrink-0 border border-pink-500/30">
                <UserCheck className="w-4 h-4" />
              </div>
              <div>
                <p className="font-extrabold text-white">Smart Match & Gender Filter</p>
                <p className="text-slate-400 text-[11px]">Choose preferred gender and moods in random chat.</p>
              </div>
            </div>

            <div className="flex items-start space-x-3 p-2.5 rounded-2xl bg-white/[0.02] border border-white/5">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/30">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <p className="font-extrabold text-white">Priority Match Queue</p>
                <p className="text-slate-400 text-[11px]">Get matched immediately at the front of the queue.</p>
              </div>
            </div>

            <div className="flex items-start space-x-3 p-2.5 rounded-2xl bg-white/[0.02] border border-white/5">
              <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0 border border-purple-500/30">
                <Camera className="w-4 h-4" />
              </div>
              <div>
                <p className="font-extrabold text-white">Custom Profile DP & Media</p>
                <p className="text-slate-400 text-[11px]">Upload custom avatars and send private chat images.</p>
              </div>
            </div>
          </div>
        </div>

        {/* 8. PERSONAL PAYMENT HISTORY */}
        <div className="rounded-3xl bg-slate-900/60 border border-slate-800 p-5 space-y-4 backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
              <History className="w-4 h-4 text-slate-400" />
              <span>Your Payment History</span>
            </h4>
            <span className="text-[10px] text-slate-500">Last 20 transactions</span>
          </div>

          {loadingHistory ? (
            <div className="py-8 text-center text-xs text-slate-400 space-y-2">
              <Loader2 className="w-5 h-5 animate-spin mx-auto text-pink-400" />
              <p>Loading payment history...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500 space-y-1">
              <CreditCard className="w-8 h-8 mx-auto opacity-30" />
              <p>No transactions found.</p>
              <p className="text-[10px]">Your submitted payments and approval status will appear here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase text-[10px]">
                    <th className="pb-2">Date</th>
                    <th className="pb-2">Request ID</th>
                    <th className="pb-2">Plan</th>
                    <th className="pb-2">Amount</th>
                    <th className="pb-2">UTR / Ref</th>
                    <th className="pb-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {history.map((p) => {
                    const isApproved = p.status === 'APPROVED' || p.status === 'approved';
                    const isPending = p.status === 'UNDER_REVIEW' || p.status === 'pending';
                    const isRejected = p.status === 'REJECTED' || p.status === 'rejected';

                    return (
                      <tr key={p.id} className="hover:bg-white/[0.02]">
                        <td className="py-2.5 text-slate-400 whitespace-nowrap text-[11px]">
                          {new Date(p.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </td>
                        <td className="py-2.5 font-mono text-[10px] text-yellow-400 whitespace-nowrap">
                          {p.requestId}
                        </td>
                        <td className="py-2.5 font-bold text-white capitalize text-[11px]">
                          {p.plan}
                        </td>
                        <td className="py-2.5 font-bold text-white text-[11px]">
                          ₹{p.amount}
                        </td>
                        <td className="py-2.5 font-mono text-slate-300 text-[10px]">
                          {p.paymentId || 'Screenshot'}
                        </td>
                        <td className="py-2.5 text-right whitespace-nowrap">
                          {isApproved && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                              ✓ Approved
                            </span>
                          )}
                          {isPending && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30">
                              ⏳ Under Review
                            </span>
                          )}
                          {isRejected && (
                            <span
                              title={p.rejectionReason || 'Rejected'}
                              className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-bold border border-rose-500/30 cursor-help"
                            >
                              ✕ Rejected
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      {/* Screenshot Lightbox Modal */}
      {selectedFullImage && (
        <div
          onClick={() => setSelectedFullImage(null)}
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 cursor-pointer backdrop-blur-md"
        >
          <img src={selectedFullImage} alt="Receipt Full" className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl" />
        </div>
      )}
    </AppShell>
  );
}
