'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  QrCode,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  UploadCloud,
  Loader2,
  ArrowLeft,
  Sparkles,
  Clock,
  ChevronRight,
  Lock,
  Copy,
  ExternalLink,
  Coins,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import confetti from 'canvas-confetti';

export default function VipPayPage() {
  const router = useRouter();

  // Payment details
  const [paymentId, setPaymentId] = useState<string>('');
  const [amount, setAmount] = useState<number>(99.0);
  const [planName, setPlanName] = useState<string>('VIP Membership');
  const merchantName = 'Lexino Enterprises';

  // Method selection: Option A (qr) vs Option B (btc)
  const [payMethod, setPayMethod] = useState<'qr' | 'btc'>('qr');
  const btcAddress = 'bc1q9v4kyf8q5x2k8l5y7x9w3p6r2n8z0a1b2c3d4e';
  const btcAmount = '0.0011 BTC';
  const [copiedBtc, setCopiedBtc] = useState<boolean>(false);

  // Stage management
  const [stage, setStage] = useState<'PAY_SCREEN' | 'FORM_SCREEN' | 'STATUS_SCREEN'>('PAY_SCREEN');
  const [status, setStatus] = useState<'PENDING_PAYMENT' | 'UNDER_REVIEW' | 'PAID' | 'REJECTED'>('PENDING_PAYMENT');
  const [rejectionReason, setRejectionReason] = useState<string>('');

  // Form inputs
  const [utrNumber, setUtrNumber] = useState<string>('');
  const [txHash, setTxHash] = useState<string>('');
  const [screenshotData, setScreenshotData] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Loading & Error states
  const [loadingPayment, setLoadingPayment] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function initPayment() {
      try {
        setLoadingPayment(true);
        const res = await fetch('/api/payments/manual/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: 99.0, planName: 'VIP Membership' }),
        });

        const data = await res.json();
        if (res.ok && data.payment) {
          setPaymentId(data.payment.paymentId);
          setAmount(data.payment.amount);
          setPlanName(data.payment.planName);
          if (data.payment.status !== 'PENDING_PAYMENT') {
            setStatus(data.payment.status);
            setStage('STATUS_SCREEN');
            if (data.payment.utrNumber) setUtrNumber(data.payment.utrNumber);
            if (data.payment.screenshotUrl) setImagePreview(data.payment.screenshotUrl);
            if (data.payment.rejectionReason) setRejectionReason(data.payment.rejectionReason);
          }
        }
      } catch (e) {
        console.error('Failed to init payment:', e);
      } finally {
        setLoadingPayment(false);
      }
    }

    initPayment();
  }, []);

  // Poll live status when under review
  useEffect(() => {
    if (stage !== 'STATUS_SCREEN' || status === 'PAID') return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/payments/manual/status?paymentId=${paymentId}`);
        const data = await res.json();
        if (res.ok && data.payment) {
          if (data.payment.status !== status) {
            setStatus(data.payment.status);
            if (data.payment.status === 'PAID') {
              confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
            } else if (data.payment.status === 'REJECTED') {
              setRejectionReason(data.payment.rejectionReason || 'Verification failed');
            }
          }
        }
      } catch (e) {
        console.error(e);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [paymentId, stage, status]);

  const handleCopyBtc = () => {
    navigator.clipboard.writeText(btcAddress);
    setCopiedBtc(true);
    setTimeout(() => setCopiedBtc(false), 2000);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validMimes.includes(file.type)) {
      setErrorMsg('Invalid image file format. Only JPG, PNG, and WebP images are allowed.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Image must be 5 MB or smaller.');
      return;
    }

    setErrorMsg('');
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setImagePreview(result);
      setScreenshotData(result);
    };
    reader.readAsDataURL(file);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSubmitting(true);

    try {
      const endpoint = payMethod === 'btc' ? '/api/payments/vip-request' : '/api/payments/manual/submit';
      const bodyPayload =
        payMethod === 'btc'
          ? { method: 'btc', txHash: txHash.trim(), screenshotData, amount }
          : { paymentId, utrNumber: utrNumber.trim(), screenshotData };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });

      const data = await res.json();
      if (res.ok && (data.success || data.request)) {
        setStatus('UNDER_REVIEW');
        setStage('STATUS_SCREEN');
      } else {
        setErrorMsg(data.error || 'Submission failed. Please check your payment details.');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#0A1128] text-white flex flex-col items-center justify-center p-3 sm:p-6 relative overflow-x-hidden font-sans">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-96 bg-gradient-to-b from-[#0066FF]/20 via-[#0052CC]/10 to-transparent blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="w-full max-w-md flex items-center justify-between py-3 z-10 mb-2">
        <Link
          href="/dashboard"
          className="flex items-center space-x-2 text-slate-300 hover:text-white transition-colors text-xs font-semibold bg-white/5 px-3 py-1.5 rounded-full border border-white/10"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </Link>

        <div className="flex items-center space-x-1.5 bg-blue-500/10 text-blue-400 text-[11px] font-bold px-3 py-1.5 rounded-full border border-blue-500/20">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Verified Merchant & VIP Gate</span>
        </div>
      </div>

      {/* Main Card */}
      <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white text-slate-900 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-blue-500/20 border border-slate-100 z-10 relative overflow-hidden"
      >
        {/* Merchant & Amount Summary */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Merchant / Brand</span>
            <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-1.5">
              {merchantName}
              <CheckCircle2 className="w-4 h-4 text-blue-600 fill-blue-600/10" />
            </h2>
          </div>

          <div className="text-right">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Total Amount</span>
            <span className="text-2xl font-black text-blue-600 tracking-tight">₹{amount.toFixed(2)}</span>
          </div>
        </div>

        {/* Method Toggle Tabs (Option A: QR Code vs Option B: Bitcoin) */}
        {stage === 'PAY_SCREEN' && (
          <div className="grid grid-cols-2 gap-2 mb-5 p-1 bg-slate-100 rounded-2xl">
            <button
              type="button"
              onClick={() => setPayMethod('qr')}
              className={`py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                payMethod === 'qr' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <QrCode className="w-4 h-4" />
              <span>UPI / QR Code</span>
            </button>

            <button
              type="button"
              onClick={() => setPayMethod('btc')}
              className={`py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                payMethod === 'btc' ? 'bg-white text-amber-600 shadow-md' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Coins className="w-4 h-4" />
              <span>Bitcoin (BTC)</span>
            </button>
          </div>
        )}

        {loadingPayment ? (
          <div className="py-16 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            <p className="text-xs font-bold text-slate-500">Loading secure payment gate...</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            
            {/* STAGE 1: OPTION A (UPI QR) or OPTION B (BITCOIN) */}
            {stage === 'PAY_SCREEN' && (
              <motion.div
                key={payMethod}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                className="space-y-6 text-center"
              >
                {payMethod === 'qr' ? (
                  /* OPTION A: UPI QR CODE */
                  <div className="space-y-5">
                    <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-extrabold border border-blue-200">
                      <Sparkles className="w-3.5 h-3.5 text-blue-600 fill-blue-600" />
                      <span>{planName} • 30 Days Access</span>
                    </div>

                    <motion.div
                      animate={{ y: [0, -5, 0] }}
                      transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                      className="relative w-64 h-80 mx-auto rounded-2xl overflow-hidden shadow-xl border-4 border-slate-100 bg-white p-2 flex flex-col items-center justify-center"
                    >
                      <img
                        src="/uploads/qr/99qr.jpeg"
                        alt="Lexino Enterprises QR Code"
                        className="w-full h-full object-contain rounded-xl"
                      />
                    </motion.div>

                    <div className="space-y-1">
                      <p className="text-xs font-black tracking-wider text-slate-700 uppercase">
                        SCAN & PAY WITH ANY UPI APP
                      </p>
                      <p className="text-[11px] text-slate-400 font-medium">GPay • PhonePe • Paytm • BHIM</p>
                    </div>
                  </div>
                ) : (
                  /* OPTION B: BITCOIN */
                  <div className="space-y-5">
                    <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-extrabold border border-amber-200">
                      <Coins className="w-3.5 h-3.5 text-amber-600" />
                      <span>Exact Amount: {btcAmount} (₹{amount})</span>
                    </div>

                    {/* BTC Wallet Address Box */}
                    <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-2 text-left relative">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        BTC Wallet Address
                      </span>
                      <p className="font-mono text-xs font-bold text-amber-400 break-all">{btcAddress}</p>
                      <button
                        type="button"
                        onClick={handleCopyBtc}
                        className="w-full py-2 rounded-xl bg-amber-500/20 text-amber-300 font-bold text-xs hover:bg-amber-500/30 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>{copiedBtc ? 'Copied to Clipboard! ✓' : 'Copy BTC Address'}</span>
                      </button>
                    </div>

                    <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-left space-y-1">
                      <p className="text-xs font-bold text-amber-900">Bitcoin Payment Notes:</p>
                      <p className="text-[11px] text-amber-800 leading-relaxed">
                        Send exact amount <span className="font-mono font-bold">{btcAmount}</span> to address above. After sending, copy your 64-character Transaction Hash (txid) and click below.
                      </p>
                    </div>
                  </div>
                )}

                {/* Primary Button */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setStage('FORM_SCREEN')}
                  className="w-full py-4 rounded-2xl font-black bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white shadow-xl shadow-blue-500/30 text-sm flex items-center justify-center space-x-2 transition-all cursor-pointer"
                >
                  <span>{payMethod === 'qr' ? 'I have already paid' : 'Submit BTC Tx Hash'}</span>
                  <ChevronRight className="w-4 h-4" />
                </motion.button>

                <p className="text-[10px] text-slate-400 font-medium">
                  VIP subscription lasts 30 days from approval. No partial refunds for unused days.
                </p>
              </motion.div>
            )}

            {/* STAGE 2: FORM SUBMISSION */}
            {stage === 'FORM_SCREEN' && (
              <motion.form
                key="form_screen"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                onSubmit={handleFormSubmit}
                className="space-y-5 text-left"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-black text-slate-900">
                      {payMethod === 'qr' ? 'UPI Verification' : 'Bitcoin Verification'}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {payMethod === 'qr' ? 'Submit UTR number or screenshot' : 'Submit transaction hash'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStage('PAY_SCREEN')}
                    className="text-xs font-bold text-blue-600 hover:underline"
                  >
                    Back to Payment
                  </button>
                </div>

                {/* UPI UTR Field */}
                {payMethod === 'qr' ? (
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                      12-Digit UTR / UPI Reference No.
                    </label>
                    <input
                      type="text"
                      maxLength={18}
                      placeholder="e.g. 423984920192"
                      value={utrNumber}
                      onChange={(e) => setUtrNumber(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                      className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 font-mono font-bold text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/40 uppercase tracking-wider"
                    />
                  </div>
                ) : (
                  /* BTC Tx Hash Field */
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                      Bitcoin Tx Hash (txid) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b"
                      value={txHash}
                      onChange={(e) => setTxHash(e.target.value)}
                      required
                      className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-amber-600/40"
                    />
                    <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1 pt-1">
                      <span>Verified on</span>
                      <a href="https://mempool.space" target="_blank" rel="noreferrer" className="text-blue-600 font-bold underline flex items-center gap-0.5">
                        mempool.space <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </p>
                  </div>
                )}

                {/* Screenshot Upload */}
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                    Proof Screenshot <span className="text-slate-400 font-normal">(Max 5MB)</span>
                  </label>

                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-200 hover:border-blue-500 bg-slate-50 hover:bg-blue-50/40 rounded-2xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-2"
                  >
                    {imagePreview ? (
                      <div className="relative w-full h-32 rounded-xl overflow-hidden border border-slate-200">
                        <img src={imagePreview} alt="Screenshot Preview" className="w-full h-full object-cover" />
                        <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/60 text-white text-[10px] font-bold">
                          Selected ✓
                        </span>
                      </div>
                    ) : (
                      <>
                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                          <UploadCloud className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-700">Click to upload screenshot proof</p>
                          <p className="text-[10px] text-slate-400">JPG, PNG up to 5MB</p>
                        </div>
                      </>
                    )}
                  </div>

                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                </div>

                {errorMsg && (
                  <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{errorMsg}</span>
                  </motion.div>
                )}

                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={submitting}
                  className="w-full py-4 rounded-2xl font-black bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 text-white shadow-xl shadow-blue-500/30 text-sm flex items-center justify-center space-x-2 transition-all cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Submitting Request...</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      <span>Submit Payment Proof</span>
                    </>
                  )}
                </motion.button>
              </motion.form>
            )}

            {/* STAGE 3: LIVE STATUS DISPLAY */}
            {stage === 'STATUS_SCREEN' && (
              <motion.div
                key="status_screen"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-6 text-center py-2"
              >
                {status === 'UNDER_REVIEW' && (
                  <div className="space-y-4">
                    <motion.div
                      animate={{ scale: [1, 1.08, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="w-16 h-16 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/20 border border-amber-300"
                    >
                      <Clock className="w-8 h-8" />
                    </motion.div>

                    <div className="space-y-1">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-800 font-extrabold text-xs">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                        PAYMENT SUBMITTED • UNDER REVIEW
                      </span>
                      <h3 className="text-lg font-black text-slate-900 tracking-tight pt-2">
                        Payment Under Verification
                      </h3>
                      <p className="text-xs text-slate-500 font-medium max-w-xs mx-auto">
                        Your VIP request is submitted and usually reviewed within 24 hours.
                      </p>
                    </div>

                    <button
                      onClick={() => router.push('/dashboard')}
                      className="w-full py-3.5 rounded-2xl font-bold bg-slate-900 text-white text-xs hover:bg-slate-800 transition-colors"
                    >
                      Go to Dashboard
                    </button>
                  </div>
                )}

                {status === 'PAID' && (
                  <div className="space-y-4">
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }} className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/20 border-2 border-emerald-400">
                      <CheckCircle2 className="w-10 h-10" />
                    </motion.div>

                    <div className="space-y-1">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-xs">
                        ✓ VIP APPROVED
                      </span>
                      <h3 className="text-xl font-black text-slate-900 tracking-tight pt-2">VIP Access Unlocked! 🎉</h3>
                      <p className="text-xs text-slate-500 font-medium">Your 30-day VIP membership is now active.</p>
                    </div>

                    <button onClick={() => router.push('/dashboard')} className="w-full py-4 rounded-2xl font-black bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xl shadow-emerald-500/30 text-sm hover:scale-105 transition-transform">
                      Start Using VIP Features Now →
                    </button>
                  </div>
                )}

                {status === 'REJECTED' && (
                  <motion.div animate={{ x: [-8, 8, -6, 6, 0] }} transition={{ duration: 0.5 }} className="space-y-4">
                    <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-lg shadow-rose-500/20 border border-rose-300">
                      <AlertCircle className="w-8 h-8" />
                    </div>

                    <div className="space-y-1">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-100 text-rose-800 font-extrabold text-xs">
                        ✕ PAYMENT REJECTED
                      </span>
                      <h3 className="text-lg font-black text-slate-900 tracking-tight pt-2">Verification Failed</h3>
                      <p className="text-xs text-rose-600 font-bold max-w-xs mx-auto">
                        Reason: {rejectionReason || 'Invalid proof or payment not received.'}
                      </p>
                    </div>

                    <button onClick={() => { setStatus('PENDING_PAYMENT'); setStage('FORM_SCREEN'); }} className="w-full py-3.5 rounded-2xl font-bold bg-blue-600 text-white text-xs hover:bg-blue-700 transition-colors">
                      Try Submitting Again
                    </button>
                  </motion.div>
                )}

              </motion.div>
            )}

          </AnimatePresence>
        )}

      </motion.div>

      <p className="text-[11px] text-slate-500 mt-6 font-medium z-10">
        Lexino Enterprises VIP Payment Verification
      </p>
    </div>
  );
}
