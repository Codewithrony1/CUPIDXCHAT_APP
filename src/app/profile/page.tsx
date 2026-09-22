'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useAuth as useClerkAuth } from '@clerk/nextjs';
import { VIP_AVATAR_CATEGORIES } from '@/lib/avatars';
import { formatDisplayDob, calculateDobAge as calculateAge } from '@/lib/validation/dob';
import AppShell from '@/components/AppShell';
import BottomSheet from '@/components/ui/BottomSheet';
import {
  User,
  Camera,
  Crown,
  Sparkles,
  Lock,
  ArrowLeft,
  Check,
  Smile,
  Zap,
  Shield,
  Heart,
  Globe,
  Loader2,
  Calendar,
  X,
  Edit3,
} from 'lucide-react';
import { DEFAULT_BIO } from '@/lib/vipCommon';

const MOOD_OPTIONS = [
  '🤪 Crazy',
  '😎 Attitude',
  '✨ Fantastic',
  '🔥 Energetic',
  '😌 Chill',
  '😂 Funny',
  '💃 Glam',
  '👑 Royal',
  '📸 Model',
  '🎧 Vibing',
  '🚀 Motivated',
  '😴 Sleepy',
  '😊 Happy',
  '🧠 Thoughtful',
  '❤️ Romantic',
  '🌸 Cute',
  '👀 Curious',
  '💪 Confident',
];

const PERSONALITY_OPTIONS = [
  '💬 Talkative',
  '😂 Funny',
  '😊 Friendly',
  '😎 Chill',
  '🔥 Energetic',
  '🧠 Intelligent',
  '🎨 Creative',
  '🎮 Gamer',
  '🎵 Music Lover',
  '🚀 Ambitious',
  '🤪 Crazy',
  '❤️ Romantic',
];

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const { getToken } = useClerkAuth();
  const router = useRouter();

  const isVIP = Boolean(
    user?.membershipTier === 'VIP' ||
    user?.is_vip ||
    user?.isVIP ||
    (user?.subscription?.isActive === true && user?.subscription?.plan === 'VIP')
  );

  // Form States
  const [displayName, setDisplayName] = useState(user?.displayName || user?.fullName || '');
  const [bio, setBio] = useState(user?.profile?.bio || DEFAULT_BIO);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [showBio, setShowBio] = useState(user?.profile?.showBio ?? true);
  const [dateOfBirth, setDateOfBirth] = useState(user?.dateOfBirth || user?.profile?.dateOfBirth || '');
  const [gender, setGender] = useState<string>(user?.gender || user?.profile?.gender || 'male');
  const [showGender, setShowGender] = useState(user?.profile?.showGender ?? true);
  const [preferredGender, setPreferredGender] = useState(user?.profile?.preferredGender || 'auto');
  const [mood, setMood] = useState(user?.profile?.mood || '');
  const [showMood, setShowMood] = useState(user?.profile?.showMood ?? true);
  const [moodDuration, setMoodDuration] = useState<'1hour' | '24hours' | 'never'>('24hours');

  // Personality Tags
  const [personalityTags, setPersonalityTags] = useState<string[]>([]);
  const [avatarType, setAvatarType] = useState<string>(user?.profile?.avatarType || 'EMOJI');
  const [avatarEmoji, setAvatarEmoji] = useState<string>(user?.profile?.avatarEmoji || '😊');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.profile?.avatarUrl || null);
  const [avatarData, setAvatarData] = useState<string>('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Modals & Bottom Sheets
  const [showVipLockModal, setShowVipLockModal] = useState(false);
  const [showMoodSheet, setShowMoodSheet] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Optional AI Gender Estimation
  const [aiEstimate, setAiEstimate] = useState<string>((user?.profile as any)?.aiGenderEstimate || 'unknown');
  const [aiConfidence, setAiConfidence] = useState<number | null>((user?.profile as any)?.aiGenderConfidence ?? null);
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiPhotoData, setAiPhotoData] = useState<string>('');
  const [aiPhotoPreview, setAiPhotoPreview] = useState<string | null>(null);
  const [aiConsentChecked, setAiConsentChecked] = useState(false);
  const [aiEstimating, setAiEstimating] = useState(false);
  const [aiErrorMsg, setAiErrorMsg] = useState('');
  const [aiSuccessMsg, setAiSuccessMsg] = useState('');
  const aiFileInputRef = useRef<HTMLInputElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || user.fullName || '');
      setBio(user.profile?.bio || DEFAULT_BIO);
      setShowBio(user.profile?.showBio ?? true);
      setDateOfBirth(user.dateOfBirth || user.profile?.dateOfBirth || '');
      setGender(user.gender || user.profile?.gender || 'male');
      setShowGender(user.profile?.showGender ?? true);
      setPreferredGender(user.profile?.preferredGender || 'auto');
      setMood(user.profile?.mood || '');
      setShowMood(user.profile?.showMood ?? true);
      setAvatarType(user.profile?.avatarType || 'EMOJI');
      setAvatarEmoji(user.profile?.avatarEmoji || '😊');
      setAvatarUrl(user.profile?.avatarUrl || null);

      const tags = user.profile?.personalityPreferences
        ? user.profile.personalityPreferences.split(',').filter(Boolean)
        : [];
      setPersonalityTags(tags);

      setAiEstimate((user.profile as any)?.aiGenderEstimate || 'unknown');
      setAiConfidence((user.profile as any)?.aiGenderConfidence ?? null);
    }
  }, [user]);

  const [payments, setPayments] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/payments/history')
      .then((res) => res.json())
      .then((data) => {
        if (data.payments) setPayments(data.payments);
      })
      .catch(console.error);
  }, []);

  // Client-side image crop & compression
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isVIP) {
      setShowVipLockModal(true);
      return;
    }

    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert('Image size must be less than 10MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const maxDim = 600;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height *= maxDim / width;
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width *= maxDim / height;
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);

        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85);
        setImagePreview(compressedBase64);
        setAvatarData(compressedBase64);
        setAvatarType('IMAGE');
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const togglePersonalityTag = (tag: string) => {
    setPersonalityTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);

    try {
      // Save directly to Authoritative Database API
      const effectiveClerkId = user?.clerkUserId || user?.id || user?.uid;
      const token = await getToken().catch(() => null);
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(effectiveClerkId ? { 'x-clerk-user-id': effectiveClerkId } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          clerkUserId: effectiveClerkId,
          displayName: isVIP ? displayName : undefined,
          bio: isVIP ? bio : undefined,
          showBio,
          gender: isVIP ? gender : undefined,
          showGender,
          preferredGender: isVIP ? preferredGender : undefined,
          personalityPreferences: isVIP ? personalityTags.join(',') : undefined,
          mood: isVIP ? mood : undefined,
          showMood,
          moodDuration,
          avatarType: isVIP ? avatarType : undefined,
          avatarEmoji: isVIP ? avatarEmoji : undefined,
          avatarData: isVIP ? (avatarData || undefined) : undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSaveSuccess(true);
        setIsEditingBio(false);
        await refreshUser();
        setTimeout(() => setSaveSuccess(false), 3000);
      } else if (res.status === 403 && data.isVipRequired) {
        setShowVipLockModal(true);
      } else {
        alert(data.error || 'Failed to save profile');
      }
    } catch (err) {
      console.error(err);
      alert('Error updating profile');
    } finally {
      setSaving(false);
    }
  };

  const handleAiPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validMimes.includes(file.type)) {
      setAiErrorMsg('Invalid image file format. Only JPG, PNG, and WebP images are allowed.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setAiErrorMsg('Image must be 5 MB or smaller.');
      return;
    }

    setAiErrorMsg('');
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setAiPhotoPreview(result);
      setAiPhotoData(result);
    };
    reader.readAsDataURL(file);
  };

  const handleRunAiEstimate = async () => {
    if (!aiConsentChecked) {
      setAiErrorMsg('Please check the consent box to proceed with optional AI estimation.');
      return;
    }

    const imageToUse = aiPhotoData || (avatarType === 'IMAGE' && (imagePreview || avatarUrl));
    if (!imageToUse) {
      setAiErrorMsg('Please select or upload a photo to analyze.');
      return;
    }

    setAiEstimating(true);
    setAiErrorMsg('');
    setAiSuccessMsg('');

    try {
      const res = await fetch('/api/profile/ai-gender-estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: imageToUse,
          consent: true,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setAiEstimate(data.aiGenderEstimate);
        setAiConfidence(data.aiGenderConfidence);
        setAiSuccessMsg(
          data.aiGenderEstimate === 'unknown'
            ? 'Estimation result is unknown or inconclusive. Your chosen profile gender remains your official identity.'
            : `AI estimate: ${data.aiGenderEstimate}. Your chosen profile gender remains your official identity.`
        );
        await refreshUser();
        setTimeout(() => {
          setShowAiModal(false);
          setAiSuccessMsg('');
        }, 2200);
      } else {
        setAiErrorMsg(data.error || 'Failed to estimate gender.');
      }
    } catch (e) {
      setAiErrorMsg('Network error while requesting AI estimation.');
    } finally {
      setAiEstimating(false);
    }
  };

  const handleClearAiEstimate = async () => {
    if (!confirm('Clear the current AI gender estimate? Your selected profile gender will not be affected.')) return;
    try {
      const res = await fetch('/api/profile/ai-gender-estimate', { method: 'DELETE' });
      if (res.ok) {
        setAiEstimate('unknown');
        setAiConfidence(null);
        await refreshUser();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const dynamicAge = calculateAge(dateOfBirth || user?.dateOfBirth || user?.profile?.dateOfBirth);

  return (
    <AppShell>
      <div className="p-4 sm:p-6 space-y-6 max-w-xl mx-auto w-full relative z-10 pb-16">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-pink-500/20 pb-4">
          <div className="flex items-center space-x-3">
            <Link
              href="/dashboard"
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-pink-300 hover:text-white transition-all cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-black text-white">Edit Profile</h1>
              <p className="text-xs text-pink-200/70">Personalize your Cupidx identity</p>
            </div>
          </div>

          <Link
            href="/vip"
            className={`px-3 py-1 rounded-full text-xs font-black flex items-center gap-1 border ${
              isVIP
                ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40'
                : 'bg-white/5 text-yellow-400 border-yellow-500/30 hover:bg-white/10'
            }`}
          >
            <Crown className="w-3.5 h-3.5 fill-current" />
            <span>{isVIP ? '💎 VIP MEMBER' : '✨ GET VIP'}</span>
          </Link>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-6">
          
          {/* SECTION 1: CUPIDX IDENTITY & AVATAR */}
          <div className="glass-romantic rounded-3xl p-6 text-center space-y-5">
            
            {/* Avatar Render Box */}
            <div className="relative w-28 h-28 mx-auto">
              {isVIP && avatarType === 'IMAGE' && (imagePreview || avatarUrl) ? (
                <img
                  src={imagePreview || avatarUrl!}
                  alt={user?.username || 'User Avatar'}
                  className="w-28 h-28 rounded-3xl object-cover bg-slate-900 border-2 border-pink-400 shadow-xl"
                />
              ) : (
                <div className="w-28 h-28 rounded-3xl bg-gradient-to-tr from-pink-600/30 to-purple-600/30 border-2 border-pink-400/50 shadow-xl flex items-center justify-center text-6xl select-none">
                  {avatarEmoji}
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  if (!isVIP) {
                    setShowVipLockModal(true);
                  } else {
                    fileInputRef.current?.click();
                  }
                }}
                className="absolute -bottom-1 -right-1 p-2 rounded-2xl bg-gradient-to-tr from-pink-600 to-rose-500 text-white shadow-lg border border-white/20 hover:scale-110 transition-transform cursor-pointer"
                title={isVIP ? 'Upload Custom Image DP' : 'Custom Image DP requires VIP'}
              >
                {isVIP ? <Camera className="w-4 h-4" /> : <Lock className="w-4 h-4 text-yellow-300" />}
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  if (!isVIP) {
                    setShowVipLockModal(true);
                    return;
                  }
                  handleImageFileChange(e);
                }}
                className="hidden"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-center gap-2">
                <h2 className="text-xl font-black text-white">{displayName || user?.username}</h2>
                {isVIP && (
                  <span className="px-2 py-0.5 rounded-md bg-gradient-to-r from-yellow-500 to-amber-500 text-slate-950 font-black text-[10px] uppercase tracking-wider shadow-sm flex items-center gap-0.5 select-none">
                    <Crown className="w-3 h-3 fill-current" />
                    <span>VIP</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-pink-200/70 font-semibold flex items-center justify-center gap-1.5">
                <span>@{user?.username}</span>
                {isVIP && (
                  <span className="text-[11px] font-bold text-yellow-300">• VIP</span>
                )}
              </p>
            </div>

            {/* Avatar Selector Section */}
            <div className="space-y-3 pt-2 border-t border-white/10">
              <label className="text-[11px] font-semibold text-pink-300 uppercase tracking-wider block text-center">
                Choose Avatar
              </label>

              {!isVIP ? (
                /* FREE USER AVATAR: LOCKED */
                <div className="space-y-3">
                  <div className="p-3 rounded-2xl bg-white/5 border border-pink-500/20 text-center space-y-2">
                    <div className="flex items-center justify-center gap-2 text-xs font-bold text-pink-200">
                      <Lock className="w-3.5 h-3.5 text-yellow-400" />
                      <span>Avatar is locked ({avatarEmoji})</span>
                    </div>
                    <p className="text-[11px] text-pink-200/70">
                      💎 Upgrade to CupidX VIP to unlock 25+ Premium Avatars &amp; Custom Profile Photos
                    </p>
                    <Link
                      href="/vip"
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-yellow-500 via-amber-500 to-yellow-600 text-slate-950 font-black text-xs shadow-md hover:scale-105 transition-all"
                    >
                      <Crown className="w-3.5 h-3.5 fill-current" />
                      <span>Unlock Avatars with VIP →</span>
                    </Link>
                  </div>
                </div>
              ) : (
                /* VIP USER CATEGORIZED AVATAR PICKER */
                <div className="space-y-4">
                  <div className="flex justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setAvatarType('EMOJI')}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                        avatarType === 'EMOJI'
                          ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-md'
                          : 'bg-white/5 text-slate-400 hover:bg-white/10'
                      }`}
                    >
                      ✨ VIP Emoji Avatars
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAvatarType('IMAGE');
                        if (!imagePreview && !avatarUrl) {
                          fileInputRef.current?.click();
                        }
                      }}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                        avatarType === 'IMAGE'
                          ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-md'
                          : 'bg-white/5 text-slate-400 hover:bg-white/10'
                      }`}
                    >
                      🖼 Custom Image
                    </button>
                  </div>

                  {avatarType === 'EMOJI' ? (
                    <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                      {VIP_AVATAR_CATEGORIES.map((cat) => (
                        <div key={cat.name} className="space-y-1 text-left">
                          <span className="text-[10px] font-extrabold text-yellow-300 uppercase tracking-wider block px-1">
                            {cat.name}
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {cat.emojis.map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => setAvatarEmoji(emoji)}
                                className={`w-9 h-9 rounded-xl text-xl flex items-center justify-center transition-all cursor-pointer select-none ${
                                  avatarEmoji === emoji
                                    ? 'bg-gradient-to-tr from-yellow-500 to-amber-400 text-slate-950 border-2 border-yellow-200 shadow-md scale-110'
                                    : 'bg-white/5 hover:bg-white/10 border border-white/10 opacity-70 hover:opacity-100'
                                }`}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-2 text-center">
                      <p className="text-xs text-pink-200/80">Custom image is set as active profile picture.</p>
                      <div className="flex justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="px-3 py-1.5 rounded-xl bg-pink-500/20 text-pink-300 font-bold text-xs border border-pink-500/30 hover:bg-pink-500/30 transition-colors"
                        >
                          Replace Image
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAvatarType('EMOJI');
                            setImagePreview(null);
                            setAvatarData('');
                          }}
                          className="px-3 py-1.5 rounded-xl bg-rose-500/20 text-rose-300 font-bold text-xs border border-rose-500/30 hover:bg-rose-500/30 transition-colors"
                        >
                          Remove Image
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Display Name & Username Edit Fields */}
            <div className="space-y-3 text-left pt-2">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-pink-300 uppercase tracking-wider block">Full / Display Name</label>
                  {isVIP ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-300 font-bold border border-pink-500/20">
                      {`Name changes left today: ${Math.max(0, 4 - ((user?.profile as any)?.nameChangesCount ?? 0))}/4`}
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-300 font-bold border border-rose-500/20 flex items-center gap-1">
                      <Lock className="w-3 h-3 text-rose-400" />
                      <span>Locked for Free</span>
                    </span>
                  )}
                </div>
                {isVIP ? (
                  <input
                    type="text"
                    maxLength={50}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Rony Rai"
                    className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs font-semibold"
                  />
                ) : (
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                    <span className="text-xs font-bold text-white">
                      {displayName || user?.fullName || user?.username}
                    </span>
                    <span className="text-[10px] text-slate-400 flex items-center gap-1 font-bold">
                      <Lock className="w-3 h-3 text-yellow-400" />
                      <span>Locked</span>
                    </span>
                  </div>
                )}
                {!isVIP && (
                  <p className="text-[10px] text-pink-200/50">
                    Profile name is locked after initial setup. Upgrade to VIP to edit your name.
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-pink-300 uppercase tracking-wider block">Unique @username</label>
                <div className="px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 font-mono text-xs">
                  @{user?.username}
                </div>
              </div>

              {/* Bio Field — Free (Default, Read-Only) vs VIP (Custom, Editable) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] font-semibold text-pink-300 uppercase tracking-wider block">Bio</label>
                    {isVIP && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-300 font-extrabold border border-yellow-500/30 flex items-center gap-0.5">
                        <Crown className="w-2.5 h-2.5 fill-current" /> VIP
                      </span>
                    )}
                  </div>
                  {isVIP && !isEditingBio && (
                    <button
                      type="button"
                      onClick={() => setIsEditingBio(true)}
                      className="text-[11px] px-2.5 py-1 rounded-xl bg-pink-500/20 text-pink-300 hover:text-white font-bold border border-pink-500/30 hover:bg-pink-500/30 transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Edit Bio</span>
                    </button>
                  )}
                  {isVIP && isEditingBio && (
                    <button
                      type="button"
                      onClick={() => setIsEditingBio(false)}
                      className="text-[11px] px-2.5 py-1 rounded-xl bg-white/10 text-slate-300 hover:text-white font-bold transition-all cursor-pointer"
                    >
                      Done
                    </button>
                  )}
                </div>

                {!isVIP ? (
                  /* FREE USER: READ-ONLY DEFAULT BIO, NO EDIT OPTION */
                  <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 text-xs text-pink-100/90 leading-relaxed italic select-none">
                    &ldquo;{user?.profile?.bio || DEFAULT_BIO}&rdquo;
                  </div>
                ) : isEditingBio ? (
                  /* VIP USER IN EDIT MODE: TEXTAREA */
                  <div className="space-y-1.5">
                    <textarea
                      rows={3}
                      maxLength={500}
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Share a short intro about yourself..."
                      className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs"
                      autoFocus
                    />
                    <div className="flex justify-between items-center text-[10px] text-slate-400 px-1">
                      <span>VIP Custom Bio</span>
                      <span>{bio.length}/500</span>
                    </div>
                  </div>
                ) : (
                  /* VIP USER IN VIEW MODE: READ CUSTOM BIO */
                  <div
                    onClick={() => setIsEditingBio(true)}
                    className="p-3.5 rounded-xl bg-white/5 border border-white/10 hover:border-pink-500/30 text-xs text-white leading-relaxed cursor-pointer transition-colors"
                  >
                    <p className="italic">
                      {bio ? `"${bio}"` : <span className="text-slate-400 not-italic">No custom bio set yet. Click &ldquo;Edit Bio&rdquo; to add one!</span>}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 2: IDENTITY, DATE OF BIRTH & GENDER */}
          <div className="glass-romantic rounded-3xl p-6 space-y-4 text-left">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <User className="w-4 h-4 text-purple-400" />
                <span>Identity, Date of Birth &amp; Gender</span>
              </h3>

              {isVIP ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 font-extrabold border border-yellow-500/30 flex items-center gap-1">
                  <Crown className="w-3 h-3 fill-current" /> Gender Editable with VIP 💎
                </span>
              ) : (
                <span className="text-[10px] px-2.5 py-0.5 rounded-full font-extrabold border bg-rose-500/15 text-rose-300 border-rose-500/30 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-rose-400" />
                  <span>Locked for Free members</span>
                </span>
              )}
            </div>

            {/* Date of Birth Field — Permanently Locked */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-pink-300 uppercase tracking-wider block">
                  Date of Birth
                </label>
                <span className="text-[10px] font-extrabold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  Age: {dynamicAge} yrs
                </span>
              </div>

              <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span className="text-xs font-bold text-white">
                    {formatDisplayDob(dateOfBirth || user?.dateOfBirth || user?.profile?.dateOfBirth)}
                  </span>
                </div>
                <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1 font-bold">
                  <Shield className="w-3 h-3 text-emerald-400" />
                  <span>Age Verified</span>
                </span>
              </div>
              <p className="text-[10px] text-pink-200/50">
                Date of birth is permanently locked to protect community safety and age verification (18+).
              </p>
            </div>

            {/* Gender Field */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-pink-300 uppercase tracking-wider block">
                Gender
              </label>

              {isVIP ? (
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Male', val: 'male' },
                    { label: 'Female', val: 'female' },
                    { label: 'Other', val: 'other' },
                  ].map((item) => (
                    <button
                      key={item.val}
                      type="button"
                      onClick={() => setGender(item.val)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        gender === item.val
                          ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white border-pink-400 shadow-md'
                          : 'bg-white/5 border-white/10 text-pink-200/70 hover:bg-white/10'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                  <span className="text-xs font-bold text-white capitalize">
                    {gender || user?.gender || user?.profile?.gender || 'Unspecified'}
                  </span>
                  <span className="text-[10px] text-slate-400 flex items-center gap-1 font-bold">
                    <Lock className="w-3 h-3 text-yellow-400" />
                    <span>Locked</span>
                  </span>
                </div>
              )}
              <p className="text-[10px] text-pink-200/50">
                {isVIP ? 'VIP members can update their gender preferences.' : 'Gender is locked after initial setup. Upgrade to VIP to change.'}
              </p>
            </div>

            {/* Optional AI Gender Assist (Assistive Signal Only) */}
            <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 space-y-2.5 mt-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  <span className="text-xs font-bold text-white">AI Gender Assist (Optional)</span>
                </div>
                <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30">
                  Assistive Only
                </span>
              </div>

              <p className="text-[10px] text-pink-200/70 leading-relaxed">
                Your selected profile gender above is always your official identity. This optional AI estimate is an assistive signal only, never treated as proof of gender, and never exposed publicly.
              </p>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/5 text-xs">
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">AI Estimate</span>
                  <span className="font-bold text-white capitalize">
                    {aiEstimate && aiEstimate !== 'unknown' ? (
                      <span className="text-purple-300 flex items-center gap-1">
                        <span>🤖 {aiEstimate}</span>
                        {aiConfidence ? (
                          <span className="text-[10px] text-slate-400 font-normal">
                            ({Math.round(aiConfidence * 100)}% confidence)
                          </span>
                        ) : null}
                      </span>
                    ) : (
                      <span className="text-slate-400 font-normal text-xs italic">Unknown / Not analyzed</span>
                    )}
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  {aiEstimate && aiEstimate !== 'unknown' && (
                    <button
                      type="button"
                      disabled={aiEstimating}
                      onClick={handleClearAiEstimate}
                      className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-[11px] font-semibold transition-colors cursor-pointer"
                    >
                      Clear
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={aiEstimating}
                    onClick={() => {
                      setAiErrorMsg('');
                      setAiSuccessMsg('');
                      setShowAiModal(true);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{aiEstimate && aiEstimate !== 'unknown' ? 'Re-estimate' : 'Estimate with AI'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3: PERSONALITY TAGS */}
          <div className="glass-romantic rounded-3xl p-6 space-y-3 text-left">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-yellow-400" />
              <span>Personality Tags</span>
            </h3>
            <p className="text-xs text-pink-200/70">Pick tags that best describe your romantic personality:</p>

            <div className="flex flex-wrap gap-2 pt-1">
              {PERSONALITY_OPTIONS.map((tag) => {
                const isSelected = personalityTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => togglePersonalityTag(tag)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-pink-600 text-white border-pink-400 shadow-md scale-105'
                        : 'bg-white/5 text-pink-200/70 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Success Banner */}
          {saveSuccess && (
            <div className="p-3 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold text-center animate-pulse">
              ✓ Profile saved successfully!
            </div>
          )}

          {/* Save Button */}
          <button
            type="submit"
            disabled={saving}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-pink-600 via-rose-500 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-black text-sm uppercase tracking-wider shadow-xl shadow-pink-500/30 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            {saving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Check className="w-5 h-5" />
                <span>Save Profile</span>
              </>
            )}
          </button>
        </form>

        {/* VIP Lock Modal */}
        {showVipLockModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-3xl bg-[#120021] border border-yellow-500/30 p-6 space-y-4 shadow-2xl text-center">
              <div className="w-14 h-14 rounded-2xl bg-yellow-500/20 border border-yellow-500/30 text-yellow-300 flex items-center justify-center mx-auto">
                <Crown className="w-8 h-8 fill-current" />
              </div>
              <h3 className="text-lg font-black text-white">CupidX VIP Feature</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Custom profile photos, unlimited DOB &amp; Gender editing, and bio customization require a CupidX VIP membership.
              </p>
              <div className="flex items-center space-x-2 pt-2">
                <Link
                  href="/vip"
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg hover:scale-105 transition-transform"
                >
                  Upgrade to VIP for ₹29
                </Link>
                <button
                  type="button"
                  onClick={() => setShowVipLockModal(false)}
                  className="px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 text-xs font-bold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Optional AI Gender Estimation Modal */}
        {showAiModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-3xl bg-[#120021] border border-purple-500/30 p-6 space-y-4 shadow-2xl text-left relative">
              <button
                type="button"
                onClick={() => {
                  setShowAiModal(false);
                  setAiErrorMsg('');
                  setAiSuccessMsg('');
                }}
                className="absolute top-4 right-4 p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-500/20 border border-purple-500/30 text-purple-300 flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">AI Gender Assist (Optional)</h3>
                  <p className="text-[11px] text-pink-200/70">In-memory assistive photo analysis</p>
                </div>
              </div>

              {/* Informative source-of-truth disclaimer */}
              <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-[11px] text-purple-200 leading-relaxed">
                <span className="font-bold block text-white mb-0.5">📌 Source of Truth Notice:</span>
                Your user-selected profile gender (<strong>{gender || 'unspecified'}</strong>) is your permanent official identity. The AI estimate is never used to restrict or verify your account, and is never shared publicly.
              </div>

              {/* Photo Input Area */}
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-pink-300 uppercase tracking-wider block">
                  Select Photo for Analysis
                </label>

                <div className="flex items-center space-x-3">
                  {aiPhotoPreview || (avatarType === 'IMAGE' && (imagePreview || avatarUrl)) ? (
                    <img
                      src={aiPhotoPreview || imagePreview || avatarUrl!}
                      alt="Analysis Preview"
                      className="w-16 h-16 rounded-2xl object-cover border border-purple-400/50 bg-slate-900"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 text-xs text-center p-1">
                      No Photo
                    </div>
                  )}

                  <div className="flex-1 space-y-1.5">
                    <button
                      type="button"
                      onClick={() => aiFileInputRef.current?.click()}
                      className="w-full py-2 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>{aiPhotoPreview ? 'Change Photo' : 'Upload Photo (max 5 MB)'}</span>
                    </button>

                    {avatarType === 'IMAGE' && (imagePreview || avatarUrl) && !aiPhotoData && (
                      <p className="text-[10px] text-purple-300">
                        Defaulting to your active avatar photo.
                      </p>
                    )}
                  </div>

                  <input
                    ref={aiFileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleAiPhotoChange}
                  />
                </div>
              </div>

              {/* Explicit Consent Checkbox */}
              <label className="flex items-start space-x-2.5 p-3 rounded-xl bg-white/5 border border-white/10 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={aiConsentChecked}
                  onChange={(e) => {
                    setAiConsentChecked(e.target.checked);
                    if (e.target.checked) setAiErrorMsg('');
                  }}
                  className="mt-0.5 rounded border-white/20 text-purple-600 focus:ring-purple-500 cursor-pointer"
                />
                <span className="text-[11px] text-slate-300 leading-tight">
                  I consent to an optional in-memory AI analysis of my photo for assistive gender estimation. I understand my chosen profile gender remains my official source of truth and photos are not permanently stored for this purpose.
                </span>
              </label>

              {/* Feedback messages */}
              {aiErrorMsg && (
                <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-medium">
                  {aiErrorMsg}
                </div>
              )}
              {aiSuccessMsg && (
                <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-medium">
                  {aiSuccessMsg}
                </div>
              )}

              {/* Modal Buttons */}
              <div className="flex items-center space-x-2 pt-1">
                <button
                  type="button"
                  disabled={aiEstimating || !aiConsentChecked}
                  onClick={handleRunAiEstimate}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-black text-xs uppercase tracking-wider shadow-lg disabled:opacity-40 cursor-pointer transition-all flex items-center justify-center gap-1.5"
                >
                  {aiEstimating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Analyzing...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Analyze &amp; Estimate</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAiModal(false)}
                  className="px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
