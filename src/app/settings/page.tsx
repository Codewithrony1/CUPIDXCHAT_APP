'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  User,
  Shield,
  Moon,
  Sun,
  Laptop,
  Trash2,
  LogOut,
  ArrowLeft,
  Check,
  Ban,
  Lock,
  Heart,
  CheckCircle2,
  FileText,
  Database,
  Globe,
  Bell,
  AlertTriangle,
  X,
  Loader2,
  CreditCard,
  Crown,
  Clock,
} from 'lucide-react';
import FloatingHearts from '@/components/FloatingHearts';
import AppShell from '@/components/AppShell';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION } from '@/lib/config/policy';
import { DEFAULT_BIO } from '@/lib/vipCommon';

interface BlockedUser {
  id: string;
  blockedId: string;
  blockedUser: {
    username: string;
    fullName: string;
    avatarUrl?: string;
  };
}

interface ConsentRecord {
  termsAccepted: boolean;
  termsAcceptedAt?: string;
  privacyAcknowledged: boolean;
  privacyAcknowledgedAt?: string;
  ageConfirmed: boolean;
  ageConfirmedAt?: string;
  randomChatAcknowledged: boolean;
  randomChatAcknowledgedAt?: string;
  locationProcessingAcknowledged: boolean;
  locationProcessingAcknowledgedAt?: string;
  marketingConsent: boolean;
  marketingConsentUpdatedAt?: string;
  termsVersion: string;
  privacyVersion: string;
  consentTimestamp?: string;
}

export default function SettingsPage() {
  const { user, logout, refreshUser } = useAuth();
  const router = useRouter();

  const isVIP = Boolean(
    user?.membershipTier === 'VIP' ||
    user?.is_vip ||
    user?.isVIP ||
    (user?.subscription?.isActive === true && user?.subscription?.plan === 'VIP')
  );

  // Profile & Theme State
  const [displayName, setDisplayName] = useState(user?.fullName || '');
  const [bio, setBio] = useState(user?.profile?.bio || DEFAULT_BIO);
  const [theme, setTheme] = useState(user?.profile?.themePreference || 'system');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Blocked Users State (VIP)
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loadingBlocks, setLoadingBlocks] = useState(true);

  // Privacy & Consent State
  const [consentData, setConsentData] = useState<ConsentRecord | null>(null);
  const [loadingConsent, setLoadingConsent] = useState(true);
  const [updatingMarketing, setUpdatingMarketing] = useState(false);

  // Payments & Subscription State
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);

  // Account Deletion State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const deleteModalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(deleteModalRef, showDeleteModal, () => {
    if (!deleteSubmitting) setShowDeleteModal(false);
  });

  // Fetch blocked users list (VIP exclusive)
  const fetchPrivacyLists = async () => {
    try {
      setLoadingBlocks(true);
      const blockRes = await fetch('/api/chat/block');
      if (blockRes.ok) {
        const data = await blockRes.json();
        setBlockedUsers(data.blockedUsers || []);
      } else {
        setBlockedUsers([]);
      }
    } catch (e) {
      console.error(e);
      setBlockedUsers([]);
    } finally {
      setLoadingBlocks(false);
    }
  };

  // Fetch user consent records
  const fetchConsentRecords = async () => {
    try {
      setLoadingConsent(true);
      const res = await fetch('/api/privacy/consent');
      if (res.ok) {
        const data = await res.json();
        setConsentData(data.consent);
      }
    } catch (e) {
      console.warn('Consent fetch notice:', e);
    } finally {
      setLoadingConsent(false);
    }
  };

  // Fetch user payment history
  const fetchPaymentHistory = async () => {
    try {
      setLoadingPayments(true);
      const res = await fetch('/api/payments/history');
      if (res.ok) {
        const data = await res.json();
        setPaymentHistory(data.payments || []);
      }
    } catch (e) {
      console.warn('Payment history fetch notice:', e);
    } finally {
      setLoadingPayments(false);
    }
  };

  useEffect(() => {
    if (user) {
      setDisplayName(user.fullName || '');
      setBio(user.profile?.bio || DEFAULT_BIO);
      setTheme(user.profile?.themePreference || 'system');
      fetchPrivacyLists();
      fetchConsentRecords();
      fetchPaymentHistory();
    }
  }, [user]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);

    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bio: isVIP ? bio : undefined,
          themePreference: theme,
        }),
      });

      if (res.ok) {
        setSaveSuccess(true);
        await refreshUser();
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleUnblock = async (blockedId: string) => {
    try {
      const res = await fetch('/api/chat/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: blockedId, action: 'unblock' }),
      });
      if (res.ok) {
        setBlockedUsers((prev) => prev.filter((b) => b.blockedId !== blockedId));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleMarketing = async (newVal: boolean) => {
    try {
      setUpdatingMarketing(true);
      const res = await fetch('/api/privacy/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketingConsent: newVal }),
      });
      if (res.ok) {
        setConsentData((prev) => (prev ? { ...prev, marketingConsent: newVal } : prev));
      }
    } catch (e) {
      console.error('Update marketing preference error:', e);
    } finally {
      setUpdatingMarketing(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (deleteConfirmInput.trim().toUpperCase() !== 'DELETE') return;

    try {
      setDeleteSubmitting(true);
      setDeleteError('');
      const res = await fetch('/api/auth/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmText: 'DELETE' }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDeleteError(data.error || 'Failed to complete deletion. Please try again.');
        setDeleteSubmitting(false);
        return;
      }

      setShowDeleteModal(false);
      await logout();
      router.push('/login');
    } catch (e: any) {
      setDeleteError(e?.message || 'Failed to complete deletion. Please try again.');
      setDeleteSubmitting(false);
    }
  };

  return (
    <AppShell>
      <div className="p-4 sm:p-6 space-y-6 max-w-xl mx-auto w-full relative z-10">
        <FloatingHearts />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-pink-500/20 pb-5">
          <div className="flex items-center space-x-3">
            <Link
              href="/dashboard"
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-pink-300 hover:text-white transition-all cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white">Settings</h1>
              <p className="text-xs text-pink-200/70">Manage your profile, theme, privacy, and data</p>
            </div>
          </div>
        </div>

        {/* Form Grid */}
        <form onSubmit={handleSaveSettings} className="space-y-6">
          {/* Section 1: Profile Information */}
          <div className="glass-romantic rounded-3xl p-6 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <User className="w-4 h-4 text-pink-400" />
              <span>Profile Information</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-pink-300 uppercase tracking-wider block">Username</label>
                <div className="px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 font-mono flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span>@{user?.username}</span>
                    {isVIP && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-gradient-to-r from-yellow-500 to-amber-500 text-slate-950 font-black flex items-center gap-0.5 select-none">
                        <Crown className="w-2.5 h-2.5 fill-current" /> VIP
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-pink-400 font-bold">Unique</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-pink-300 uppercase tracking-wider block">Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs"
                />
              </div>
            </div>

            {/* Age & Gender Confirmation (Locked) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-1">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-pink-300 uppercase tracking-wider block">Age &amp; DOB</label>
                <div className="px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 flex items-center justify-between">
                  <span>{user?.profile?.age ? `${user.profile.age} years old (18+)` : '18+ Verified'}</span>
                  <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-0.5">
                    <Lock className="w-3 h-3" /> Locked
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-pink-300 uppercase tracking-wider block">Gender</label>
                <div className="px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 capitalize flex items-center justify-between">
                  <span>{user?.profile?.gender || user?.gender || 'Unspecified'}</span>
                  <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-0.5">
                    <Lock className="w-3 h-3" /> Locked
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-pink-300 uppercase tracking-wider block">Bio</label>
                {isVIP && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 font-extrabold border border-yellow-500/30 flex items-center gap-1">
                    <Crown className="w-3 h-3 fill-current" /> VIP
                  </span>
                )}
              </div>
              {!isVIP ? (
                <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 text-xs text-pink-100/90 leading-relaxed italic select-none">
                  &ldquo;{user?.profile?.bio || DEFAULT_BIO}&rdquo;
                </div>
              ) : (
                <textarea
                  rows={3}
                  maxLength={500}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Share something about yourself..."
                  className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs"
                />
              )}
            </div>
          </div>

          {/* Section 2: Privacy (Blocked Users - VIP Exclusive) */}
          <div className="glass-romantic rounded-3xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-purple-400" />
                <span>Blocked Members</span>
              </h3>
              {!isVIP && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 font-extrabold border border-yellow-500/30 flex items-center gap-0.5">
                  <Lock className="w-3 h-3" /> VIP Feature
                </span>
              )}
            </div>

            <div className="space-y-3">
              {!isVIP ? (
                <div className="text-xs text-pink-200/70 p-4 rounded-2xl bg-white/5 border border-yellow-500/20 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-yellow-300 font-bold">
                    <Lock className="w-3.5 h-3.5" />
                    <span>Exclusive VIP Privacy Control</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Blocking members and managing your blocked users list is an exclusive CupidX VIP privilege. Upgrade to VIP to block users and keep your experience personalized.
                  </p>
                </div>
              ) : loadingBlocks ? (
                <div className="text-xs text-pink-200/50">Loading blocked members...</div>
              ) : blockedUsers.length === 0 ? (
                <div className="text-xs text-pink-200/60 italic p-3 rounded-2xl bg-white/5 border border-white/5">
                  You have not blocked any members.
                </div>
              ) : (
                <div className="space-y-2">
                  {blockedUsers.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-3">
                        <img
                          src={item.blockedUser.avatarUrl || '/default-avatar.png'}
                          alt={item.blockedUser.username}
                          className="w-8 h-8 rounded-full object-cover bg-slate-800"
                        />
                        <div>
                          <p className="text-xs font-bold text-white">@{item.blockedUser.username}</p>
                          <p className="text-[10px] text-pink-200/60">{item.blockedUser.fullName}</p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleUnblock(item.blockedId)}
                        className="px-3 py-1.5 rounded-xl bg-pink-500/20 hover:bg-pink-500/40 text-pink-300 text-xs font-bold border border-pink-500/30 transition-all cursor-pointer"
                      >
                        Unblock
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Privacy & Consent Preferences */}
          <div className="glass-romantic rounded-3xl p-6 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span>Consent &amp; Privacy Status</span>
            </h3>

            <div className="space-y-2.5 text-xs">
              <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                <div>
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-pink-400" />
                    <span>Terms of Service</span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Version: {consentData?.termsVersion || CURRENT_TERMS_VERSION}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Accepted
                  </span>
                  <Link href="/terms" className="text-[11px] text-pink-300 hover:text-white underline font-semibold">
                    View
                  </Link>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                <div>
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-purple-400" />
                    <span>Privacy Policy</span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Version: {consentData?.privacyVersion || CURRENT_PRIVACY_VERSION}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Acknowledged
                  </span>
                  <Link href="/privacy" className="text-[11px] text-pink-300 hover:text-white underline font-semibold">
                    View
                  </Link>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                <div>
                  <div className="font-bold text-white">Age Requirement (18+)</div>
                  <div className="text-[11px] text-slate-400">Adult social interaction eligibility</div>
                </div>
                <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Confirmed
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                <div>
                  <div className="font-bold text-white">Random Stranger Chat</div>
                  <div className="text-[11px] text-slate-400">Connection to unacquainted members</div>
                </div>
                <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Acknowledged
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                <div>
                  <div className="font-bold text-white">Approximate Country Processing</div>
                  <div className="text-[11px] text-slate-400">Flag &amp; security abuse prevention</div>
                </div>
                <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Acknowledged
                </span>
              </div>

              {/* Optional Marketing Toggle */}
              <div className="p-3 rounded-2xl bg-white/5 border border-pink-500/20 flex items-center justify-between">
                <div>
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <Bell className="w-3.5 h-3.5 text-pink-400" />
                    <span>Product Updates &amp; Announcements</span>
                  </div>
                  <div className="text-[11px] text-pink-200/60">
                    Optional communications. You may withdraw consent anytime.
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(consentData?.marketingConsent)}
                    disabled={updatingMarketing}
                    onChange={(e) => handleToggleMarketing(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-600"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Section 4: Your Data & Transparency */}
          <div className="glass-romantic rounded-3xl p-6 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-400" />
              <span>Your Data &amp; Transparency</span>
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              CupidX processes only the categories of personal data strictly necessary to operate the platform securely:
            </p>

            <div className="space-y-2 text-xs text-slate-300">
              <div className="p-3 rounded-2xl bg-black/40 border border-white/5 space-y-1">
                <span className="font-bold text-pink-300 block">1. Authentication &amp; Identity</span>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Secured via Clerk. Includes your verified email, unique @username, public display name, date of birth (18+ gate), gender, and avatar.
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-black/40 border border-white/5 space-y-1">
                <span className="font-bold text-pink-300 block">2. Ephemeral Chat Messages (Zero Permanent Retention)</span>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Messages transmitted during random chats are temporary. They are automatically destroyed from server memory immediately when either partner clicks NEXT or disconnects.
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-black/40 border border-white/5 space-y-1">
                <span className="font-bold text-pink-300 block">3. Technical &amp; Approximate Country Information</span>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Your IP address is used strictly for rate-limiting, anti-abuse defense, and deriving your approximate country flag. Your raw IP address is never shared with your chat partners.
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-black/40 border border-white/5 space-y-1">
                <span className="font-bold text-pink-300 block">4. VIP &amp; Transaction Records</span>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Manual UPI UTR/payment verification records are processed for subscription activation and accounting records as required by financial regulations.
                </p>
              </div>
            </div>
          </div>

          {/* Section 5: Payments & Subscription */}
          <div className="glass-romantic rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-pink-400" />
                <span>Payments &amp; Subscription</span>
              </h3>
              <span
                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                  isVIP
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 flex items-center gap-1'
                    : 'bg-white/10 text-slate-300 border-white/20'
                }`}
              >
                {isVIP ? (
                  <>
                    <Crown className="w-3 h-3 text-amber-400" /> VIP Active
                  </>
                ) : (
                  'Free Member'
                )}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div>
                  <div className="font-bold text-white">Current Plan: {isVIP ? (user?.subscription?.plan || 'VIP Membership') : 'Free Tier'}</div>
                  <div className="text-[11px] text-slate-400">
                    {isVIP ? (
                      user?.vip_expires_at ? `Valid until ${new Date(user.vip_expires_at).toLocaleDateString()}` : 'Active VIP status'
                    ) : (
                      'Upgrade to VIP for image sharing, custom avatars, and enhanced profile badges.'
                    )}
                  </div>
                </div>
                <Link
                  href="/premium"
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 text-white font-bold text-xs shadow-md shadow-pink-500/20 text-center transition-all cursor-pointer"
                >
                  {isVIP ? 'Manage VIP' : 'Upgrade to VIP (from ₹29)'}
                </Link>
              </div>
            </div>

            {/* Payment & UTR History */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-pink-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-pink-400" />
                <span>Billing &amp; Payment History</span>
              </h4>

              {loadingPayments ? (
                <div className="p-3 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-pink-400" />
                  <span>Loading billing records...</span>
                </div>
              ) : paymentHistory.length === 0 ? (
                <p className="text-[11px] text-slate-400 bg-black/20 p-3 rounded-xl border border-white/5">
                  No payment records found. Payments made via manual UPI QR verification will appear here once submitted.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {paymentHistory.map((item) => (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="font-bold text-white flex items-center gap-2">
                          <span>{item.currency === 'INR' ? '₹' : '$'}{item.amount}</span>
                          <span className="text-[10px] text-pink-300/80 font-normal uppercase">({item.plan})</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          Ref: {item.paymentId || item.requestId.slice(0, 8)} • {new Date(item.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          item.status === 'approved' || item.status === 'APPROVED'
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : item.status === 'rejected' || item.status === 'REJECTED'
                            ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                            : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Section 6: Appearance & Theme */}
          <div className="glass-romantic rounded-3xl p-6 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Moon className="w-4 h-4 text-purple-400" />
              Appearance Theme
            </h3>

            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`p-4 rounded-2xl border text-xs font-bold flex flex-col items-center justify-center space-y-2 transition-all cursor-pointer ${
                  theme === 'light'
                    ? 'bg-pink-500/20 border-pink-400 text-white shadow-lg shadow-pink-500/20'
                    : 'bg-white/5 border-white/10 text-pink-200/70 hover:bg-white/10'
                }`}
              >
                <Sun className="w-5 h-5 text-amber-400" />
                <span>Light</span>
              </button>

              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`p-4 rounded-2xl border text-xs font-bold flex flex-col items-center justify-center space-y-2 transition-all cursor-pointer ${
                  theme === 'dark'
                    ? 'bg-pink-500/20 border-pink-400 text-white shadow-lg shadow-pink-500/20'
                    : 'bg-white/5 border-white/10 text-pink-200/70 hover:bg-white/10'
                }`}
              >
                <Moon className="w-5 h-5 text-purple-400" />
                <span>Dark</span>
              </button>

              <button
                type="button"
                onClick={() => setTheme('system')}
                className={`p-4 rounded-2xl border text-xs font-bold flex flex-col items-center justify-center space-y-2 transition-all cursor-pointer ${
                  theme === 'system'
                    ? 'bg-pink-500/20 border-pink-400 text-white shadow-lg shadow-pink-500/20'
                    : 'bg-white/5 border-white/10 text-pink-200/70 hover:bg-white/10'
                }`}
              >
                <Laptop className="w-5 h-5 text-pink-400" />
                <span>System</span>
              </button>
            </div>
          </div>

          {saveSuccess && (
            <div className="p-3 rounded-2xl bg-green-500/15 border border-green-500/30 text-xs text-green-400 text-center font-bold flex items-center justify-center gap-1">
              <Check className="w-4 h-4" /> Settings saved successfully!
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 text-white font-bold text-xs shadow-lg shadow-pink-500/30 transition-all cursor-pointer disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </form>

        {/* Section 6: Danger Zone (Logout & Delete Account) */}
        <div className="glass-romantic rounded-3xl p-6 space-y-4 border border-rose-500/30">
          <h3 className="text-base font-bold text-rose-400 flex items-center gap-2">
            <Trash2 className="w-4 h-4" />
            <span>Account Management &amp; Data Rights</span>
          </h3>

          <p className="text-xs text-slate-400 leading-relaxed">
            You maintain full ownership of your data. You may log out of your session or request permanent account and data deletion at any time.
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={logout}
              className="w-full py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/15 text-pink-200 font-bold text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Log Out</span>
            </button>

            <button
              onClick={() => {
                setDeleteConfirmInput('');
                setDeleteError('');
                setShowDeleteModal(true);
              }}
              className="w-full py-3 rounded-2xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 font-bold text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete Account &amp; Data</span>
            </button>
          </div>
        </div>
      </div>

      {/* Accessible Account Deletion Confirmation Modal (Requirement 15, 16, 17) */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div
            ref={deleteModalRef}
            role="dialog"
            aria-modal="true"
            aria-label="Delete Account Confirmation"
            tabIndex={-1}
            className="w-full max-w-md rounded-3xl bg-[#140020] border border-rose-500/40 p-6 space-y-5 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-rose-400">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="text-base font-black text-white">Delete Account &amp; Data?</h3>
              </div>
              <button
                type="button"
                onClick={() => !deleteSubmitting && setShowDeleteModal(false)}
                className="p-1 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-300 bg-rose-500/10 p-4 rounded-2xl border border-rose-500/20 leading-relaxed max-h-60 overflow-y-auto pr-1">
              <p className="font-bold text-rose-300">
                This action is immediate, irreversible, and permanent:
              </p>
              <ul className="list-disc pl-4 space-y-1.5 text-slate-300">
                <li><strong>Profile &amp; Identity:</strong> Your profile, avatar, and @{user?.username} identity will be permanently erased.</li>
                <li><strong>Application Data:</strong> Friendships, friend requests, direct chat threads, and block lists will be deleted.</li>
                <li><strong>Active Random Chat:</strong> Any live random chat session will immediately terminate and notify your partner.</li>
                <li><strong>VIP &amp; Subscription:</strong> Active VIP access ends immediately without automatic refund, as outlined in the Refund Policy.</li>
                <li><strong>Statutory Financial Records:</strong> Basic transaction references (UTR, amount, date) are retained without personal profile data for mandatory tax and accounting compliance.</li>
                <li><strong>48-Hour Security Lock:</strong> A minimal, salted cryptographic hash (HMAC-SHA256) of your verified email will be held for 48 hours solely to prevent immediate re-registration abuse. Your raw email address is not stored for this purpose, and the restriction expires automatically after 48 hours.</li>
              </ul>
            </div>

            <div className="space-y-1.5 text-left">
              <label className="text-xs font-bold text-slate-300 block">
                To confirm deletion, type <span className="font-mono text-rose-400 font-black select-all">DELETE</span> below:
              </label>
              <input
                type="text"
                placeholder="Type DELETE to confirm"
                value={deleteConfirmInput}
                onChange={(e) => setDeleteConfirmInput(e.target.value)}
                disabled={deleteSubmitting}
                className="w-full px-4 py-3 rounded-2xl bg-black/60 border border-slate-700 text-xs text-white focus:outline-none focus:ring-1 focus:ring-rose-500 font-mono"
              />
            </div>

            {deleteError && (
              <div className="p-3 rounded-2xl bg-rose-500/20 border border-rose-500/30 text-xs text-rose-300 font-bold text-center">
                {deleteError}
              </div>
            )}

            <div className="flex items-center space-x-3 pt-1">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleteSubmitting}
                className="flex-1 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleteSubmitting || deleteConfirmInput.trim().toUpperCase() !== 'DELETE'}
                className="flex-1 py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black transition-all shadow-lg shadow-rose-600/30 flex items-center justify-center space-x-1.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {deleteSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Permanently Delete My Account</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
