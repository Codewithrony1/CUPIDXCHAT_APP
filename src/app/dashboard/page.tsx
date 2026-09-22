'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import AppShell from '@/components/AppShell';
import BottomSheet from '@/components/ui/BottomSheet';
import { DEFAULT_BIO } from '@/lib/vipCommon';
import {
  Search,
  Sparkles,
  Heart,
  Crown,
  ArrowRight,
  UserCheck,
  Shield,
  MessageSquare,
  Zap,
  Lock,
  Smile,
  User,
  Settings,
  X,
  Check,
  Radio,
  Loader2,
  AlertCircle,
} from 'lucide-react';

interface SearchUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  isOnline: boolean;
}

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

export default function DashboardPage() {
  const { user, loading, refreshUser } = useAuth();
  const router = useRouter();

  useEffect(() => {
    console.log('[CUPIDX AUTH 8] dashboard mounted');
    console.log('[CUPIDX AUTH 9] dashboard auth state', {
      user: user?.uid,
      loading,
    });
  }, [loading, user]);

  const isVIP = user?.membershipTier === 'VIP' || (user?.subscription?.isActive === true && user?.subscription?.plan === 'VIP');

  const isProfileComplete = Boolean(
    user &&
    user.username &&
    !user.username.startsWith('user_') &&
    (user.profileCompleted ||
     user.profileLocked ||
     user.genderDobLocked ||
     (user.profile as any)?.profileCompleted ||
     user.profile?.ageGenderConfirmed ||
     ((user?.dateOfBirth || user?.profile?.dateOfBirth) && user?.gender && user?.gender !== 'unspecified' && (user?.fullName || user?.displayName)))
  );

  useEffect(() => {
    if (!loading && user && !isProfileComplete) {
      router.replace('/setup-profile');
    }
  }, [loading, user, isProfileComplete, router]);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);

  const [preferredGender, setPreferredGender] = useState(user?.profile?.preferredGender || 'auto');
  const [language, setLanguage] = useState(user?.profile?.language || 'english');
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [randomChatEnabled, setRandomChatEnabled] = useState(true);

  // Fetch Random Chat global service status
  useEffect(() => {
    fetch('/api/settings/random-chat')
      .then((res) => res.json())
      .then((data) => {
        if (typeof data.enabled === 'boolean') {
          setRandomChatEnabled(data.enabled);
        }
      })
      .catch(() => {});
  }, []);

  // Mood Bottom Sheet State
  const [showMoodSheet, setShowMoodSheet] = useState(false);
  const [currentMood, setCurrentMood] = useState(user?.profile?.mood || '😎 Attitude');
  const [savingMood, setSavingMood] = useState(false);

  // Search users by username (VIP Only)
  useEffect(() => {
    if (!isVIP || !searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.users || []);
        } else {
          setSearchResults([]);
        }
      } catch (e) {
        console.error(e);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, isVIP]);

  const handleSelectMood = async (selectedMood: string) => {
    setCurrentMood(selectedMood);
    setSavingMood(true);
    try {
      await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mood: selectedMood }),
      });
      await refreshUser();
      setShowMoodSheet(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSavingMood(false);
    }
  };

  const handleStartDirectChat = async (targetUsername: string) => {
    try {
      const res = await fetch('/api/chat/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUsername }),
      });

      const data = await res.json();

      if (res.status === 409 && data.activeSessionId) {
        alert(data.message);
        router.push(`/chat/random`);
        return;
      }

      if (res.ok && data.sessionId) {
        router.push(`/chat/random`);
      } else {
        alert(data.error || data.message || 'Unable to connect');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSavePreferences = async (newGender: string, newLang: string) => {
    setPreferredGender(newGender);
    setLanguage(newLang);
    setSavingPrefs(true);
    try {
      await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferredGender: newGender, language: newLang }),
      });
      await refreshUser();
    } catch (e) {
      console.error(e);
    } finally {
      setSavingPrefs(false);
    }
  };

  if (loading || !user || !isProfileComplete) {
    return (
      <AppShell>
        <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-pink-600 via-rose-500 to-fuchsia-500 flex items-center justify-center shadow-xl shadow-pink-500/40 animate-pulse">
            <Heart className="w-7 h-7 text-white fill-white" />
          </div>
          <div className="flex items-center space-x-2 text-pink-300 text-xs font-bold">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Loading CupidX Dashboard...</span>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="p-4 sm:p-6 space-y-6 max-w-xl mx-auto w-full">
        
        {/* User Greeting & VIP Status Badge */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center space-x-2 text-pink-300 text-xs font-extrabold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Good day</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {user?.displayName || user?.fullName ? `Hi, ${user.displayName || user.fullName} 👋` : 'Hi there 👋'}
            </h1>
          </div>

          <Link
            href="/vip"
            className={`px-3 py-1.5 rounded-full text-xs font-black flex items-center gap-1 shadow-md border ${
              isVIP
                ? 'bg-gradient-to-r from-yellow-500 to-amber-600 text-slate-950 border-yellow-400'
                : 'bg-white/5 text-yellow-400 border-yellow-500/40 hover:bg-white/10'
            }`}
          >
            <Crown className="w-3.5 h-3.5 fill-current" />
            <span>{isVIP ? '💎 VIP MEMBER' : '✨ Upgrade to VIP'}</span>
          </Link>
        </div>

        {/* 2. MEMBERSHIP CARD (Requirement 2) */}
        {!isVIP ? (
          <div className="glass rounded-3xl p-5 border border-pink-500/25 space-y-3 relative overflow-hidden bg-gradient-to-r from-pink-950/40 via-purple-950/40 to-slate-950/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-pink-400 fill-current" />
                <span className="text-xs font-black text-white uppercase tracking-wider">✨ CUPIDX FREE MEMBER</span>
              </div>
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <h3 className="text-sm font-black text-white">Unlock Cupidx VIP</h3>
                <span className="text-[10px] text-yellow-300 font-extrabold bg-yellow-500/20 px-2 py-0.5 rounded border border-yellow-500/30">
                  ONLY ₹29/mo (85% OFF)
                </span>
              </div>
              <p className="text-xs text-pink-200/70 mt-0.5">
                Customize your profile, target gender matches & express yourself for less than ₹1/day.
              </p>
            </div>
            <Link
              href="/vip"
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-2xl bg-gradient-to-r from-yellow-500 via-amber-500 to-yellow-600 hover:from-yellow-400 hover:to-amber-500 text-slate-950 font-black text-xs shadow-md hover:scale-102 transition-transform cursor-pointer border border-yellow-300/40"
            >
              <Crown className="w-3.5 h-3.5 fill-current" />
              <span>GET VIP FOR ₹29 ONLY</span>
            </Link>
          </div>
        ) : (
          <div className="glass-romantic rounded-3xl p-5 border border-yellow-500/30 space-y-3 relative overflow-hidden bg-gradient-to-r from-yellow-950/40 via-amber-950/30 to-slate-950/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Crown className="w-4 h-4 text-yellow-400 fill-current" />
                <span className="text-xs font-black text-yellow-300 uppercase tracking-wider">💎 CUPIDX VIP MEMBER</span>
              </div>
            </div>
            <p className="text-xs text-pink-100/90 font-medium">
              Your premium profile is active. Enjoy custom DP, personality matching & VIP bans.
            </p>
            <Link
              href="/vip"
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-2xl bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border border-yellow-500/40 font-black text-xs transition-all cursor-pointer"
            >
              <span>MANAGE VIP</span>
            </Link>
          </div>
        )}

        {/* Quick Search & Random Chat */}
        <div className="space-y-3">
          {/* VIP Username Search or Free Locked Indicator */}
          {isVIP ? (
            <>
              {/* Live Username Search Bar */}
              <div className="relative">
                <Search className="absolute left-4 top-3.5 w-4 h-4 text-pink-400" />
                <input
                  type="text"
                  placeholder="🔍 Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-2xl glass-input text-xs text-white placeholder:text-pink-300/40 focus:outline-none focus:ring-2 focus:ring-pink-500/50"
                />
                {searching && (
                  <div className="absolute right-4 top-3.5 text-pink-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                )}
              </div>

              {/* Search Results Drawer */}
              {searchResults.length > 0 && (
                <div className="p-3 rounded-2xl bg-slate-900/90 border border-pink-500/30 space-y-2 animate-in fade-in duration-200">
                  <span className="text-[11px] font-bold text-pink-300 px-1">Matching Users</span>
                  {searchResults.map((u) => (
                    <div
                      key={u.id}
                      className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-between transition-colors"
                    >
                      <div className="flex items-center space-x-2.5">
                        <img
                          src={u.avatarUrl || '/default-avatar.png'}
                          alt={`Profile picture for ${u.displayName || u.username || 'User'}`}
                          className="w-8 h-8 rounded-full object-cover bg-slate-800"
                        />
                        <div>
                          <p className="text-xs font-bold text-white">{u.displayName || 'User'}</p>
                          <p className="text-[10px] text-pink-200/60">{u.isOnline ? 'Online now' : 'Active Member'}</p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleStartDirectChat(u.username)}
                        className="px-3 py-1.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs shadow-sm cursor-pointer"
                      >
                        Chat
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="p-3.5 rounded-2xl glass border border-yellow-500/20 bg-gradient-to-r from-yellow-950/20 via-pink-950/20 to-slate-950/40 flex items-center justify-between gap-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center shrink-0">
                  <Crown className="w-4 h-4 text-yellow-400" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Direct Username Search</p>
                  <p className="text-[10px] text-pink-200/60">Search &amp; chat directly by username — VIP Exclusive</p>
                </div>
              </div>
              <Link
                href="/vip"
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-slate-950 font-black text-xs shrink-0 shadow-sm transition-transform active:scale-95 cursor-pointer"
              >
                Unlock VIP
              </Link>
            </div>
          )}

          {/* ── HERO: Knot/Omegle Style Random Chat CTA ── */}
          <div className="relative rounded-3xl overflow-hidden border border-pink-500/30 shadow-2xl shadow-pink-900/40">
            {/* Background animated gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#1a0030] via-[#2d0050] to-[#0d0014]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(236,72,153,0.18)_0%,transparent_70%)]" />

            {/* Radar pulse rings */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-48 h-48 rounded-full border border-pink-500/10 animate-ping" style={{ animationDuration: '2s' }} />
              <div className="absolute w-64 h-64 rounded-full border border-fuchsia-500/8 animate-ping" style={{ animationDuration: '2.8s', animationDelay: '0.5s' }} />
              <div className="absolute w-80 h-80 rounded-full border border-rose-500/6 animate-ping" style={{ animationDuration: '3.5s', animationDelay: '1s' }} />
            </div>

            <div className="relative z-10 p-7 flex flex-col items-center text-center space-y-5">
              {/* Live badge */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-pink-500/20 backdrop-blur-sm">
                <span className={`w-2 h-2 rounded-full ${randomChatEnabled ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)] animate-pulse' : 'bg-rose-400'}`} />
                <span className={`text-[11px] font-bold tracking-wide uppercase ${randomChatEnabled ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {randomChatEnabled ? 'Live Now — Chat Instantly' : 'Service Paused — Offline'}
                </span>
              </div>

              {/* Icon */}
              <div className="relative">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-pink-600 via-rose-500 to-fuchsia-500 flex items-center justify-center shadow-2xl shadow-pink-500/50">
                  <Heart className="w-10 h-10 text-white fill-white" />
                </div>
                <div className="absolute -inset-1 rounded-3xl bg-gradient-to-tr from-pink-500 to-fuchsia-500 opacity-30 blur-lg animate-pulse" />
              </div>

              {/* Heading */}
              <div className="space-y-1.5">
                <h2 className="text-3xl font-black text-white tracking-tight leading-tight">
                  Random Chat
                </h2>
                <p className="text-sm text-pink-200/70 max-w-[260px] mx-auto leading-relaxed">
                  Connect instantly with strangers online. Press <span className="text-pink-300 font-bold">NEXT</span> anytime to skip.
                </p>
              </div>

              {/* Gender quick filter pills */}
              <div className="flex items-center gap-2 flex-wrap justify-center">
                {[
                  { label: '🌍 Anyone', val: 'auto' },
                  { label: '👩 Girls', val: 'female', vip: true },
                  { label: '👦 Boys', val: 'male', vip: true },
                ].map(({ label, val, vip }) => {
                  const active = preferredGender === val;
                  const locked = vip && !isVIP;
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => {
                        if (locked) {
                          alert('🔒 Gender targeting is a VIP feature! Upgrade to VIP.');
                          return;
                        }
                        handleSavePreferences(val, language);
                      }}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                        active
                          ? 'bg-pink-500 border-pink-400 text-white shadow-lg shadow-pink-500/30'
                          : locked
                          ? 'bg-white/5 border-yellow-500/30 text-yellow-300/70'
                          : 'bg-white/5 border-white/10 text-pink-200/80 hover:bg-white/10 hover:border-pink-500/30'
                      }`}
                    >
                      {label}
                      {locked && <Lock className="w-3 h-3 text-yellow-400" />}
                    </button>
                  );
                })}
              </div>

              {/* Big START button or Service Offline Banner */}
              {randomChatEnabled ? (
                <Link
                  href="/chat/random"
                  className="w-full py-4 rounded-2xl font-black text-lg tracking-wide bg-gradient-to-r from-pink-600 via-rose-500 to-fuchsia-600 hover:from-pink-500 hover:to-fuchsia-500 text-white shadow-2xl shadow-pink-600/50 active:scale-95 transition-all flex items-center justify-center gap-3 border border-pink-400/40 cursor-pointer"
                >
                  <Radio className="w-5 h-5 animate-pulse" />
                  <span>START CHATTING</span>
                  <ArrowRight className="w-5 h-5" />
                </Link>
              ) : (
                <div className="w-full py-4 px-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-center space-y-1">
                  <div className="text-sm font-black text-rose-300 uppercase tracking-wider flex items-center justify-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400" />
                    <span>Random Chat Currently Unavailable</span>
                  </div>
                  <p className="text-xs text-rose-200/80 font-medium">
                    Random Chat is currently unavailable. Please try again later.
                  </p>
                </div>
              )}

              {/* Stats row */}
              <div className="flex items-center gap-4 text-[11px] text-pink-300/50 font-medium pt-1">
                <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> Anonymous</span>
                <span className="text-pink-500/30">•</span>
                <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> Instant Match</span>
                <span className="text-pink-500/30">•</span>
                <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" /> Free</span>
              </div>
            </div>
          </div>
        </div>

        {/* Current Mood Widget (VIP Exclusive Feature) */}
        <div className="glass-romantic rounded-3xl p-5 space-y-3 border border-pink-500/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5">
              <span className="text-xs font-bold text-pink-300 uppercase tracking-wider">Current Mood</span>
              {!isVIP && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-300 font-extrabold border border-yellow-500/30 flex items-center gap-0.5">
                  <Lock className="w-2.5 h-2.5" /> VIP
                </span>
              )}
            </div>
            <button
              onClick={() => {
                if (!isVIP) {
                  alert('🔒 Changing your mood is an exclusive VIP feature! Upgrade to VIP to personalize your mood.');
                  return;
                }
                setShowMoodSheet(true);
              }}
              className="text-xs font-bold text-pink-400 hover:text-pink-300 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Smile className="w-3.5 h-3.5" />
              <span>Change</span>
              {!isVIP && <Lock className="w-3 h-3 text-yellow-400" />}
            </button>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center space-x-3">
            <span className="text-2xl leading-none">{currentMood.split(' ')[0]}</span>
            <div>
              <p className="text-xs font-bold text-white">{currentMood}</p>
              <p className="text-[10px] text-pink-200/60">Visible on your profile & chat card</p>
            </div>
          </div>
        </div>


        {/* User Profile Personalization Summary */}
        <div className="glass-romantic rounded-3xl p-5 space-y-4 border border-pink-500/20">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <User className="w-4 h-4 text-pink-400" />
              Your Profile Overview
            </h3>
            <Link
              href="/profile"
              className="text-xs font-bold text-pink-400 hover:text-pink-300 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span>Edit Profile</span>
            </Link>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-center space-x-3">
              <img
                src={user?.profile?.avatarUrl || `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${user?.displayName || user?.id || 'cupidx'}`}
                alt={`Profile picture for ${user?.displayName || user?.fullName || 'My Profile'}`}
                className="w-10 h-10 rounded-full object-cover bg-slate-800 border border-pink-400/50"
              />
              <div>
                <div className="flex items-center gap-1.5">
                  <h4 className="text-sm font-bold text-white">{user?.displayName || user?.fullName || 'My Profile'}</h4>
                  {isVIP && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-gradient-to-r from-yellow-500 to-amber-500 text-slate-950 font-black flex items-center gap-0.5 select-none">
                      <Crown className="w-2.5 h-2.5 fill-current" /> VIP
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-pink-200/70">{user?.gender ? (user.gender.charAt(0).toUpperCase() + user.gender.slice(1)) : 'Active Member'}</p>
              </div>
            </div>

            <p className="text-xs text-pink-200/80 italic p-2.5 rounded-xl bg-white/5">
              &ldquo;{user?.profile?.bio || DEFAULT_BIO}&rdquo;
            </p>
          </div>
        </div>
      </div>

      {/* Mood Bottom Sheet (Requirement 11) */}
      <BottomSheet isOpen={showMoodSheet} onClose={() => setShowMoodSheet(false)} title="Select your mood">
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-2.5 max-h-[50vh] overflow-y-auto pr-1">
            {MOOD_OPTIONS.map((m) => {
              const selected = currentMood === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => handleSelectMood(m)}
                  className={`p-3 rounded-2xl border text-xs font-bold text-left flex items-center justify-between transition-all cursor-pointer ${
                    selected
                      ? 'bg-pink-500/25 border-pink-400 text-white shadow-md'
                      : 'bg-white/5 border-white/10 text-pink-200/80 hover:bg-white/10'
                  }`}
                >
                  <span>{m}</span>
                  {selected && <Check className="w-4 h-4 text-pink-400" />}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setShowMoodSheet(false)}
            className="w-full py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-colors cursor-pointer"
          >
            DONE
          </button>
        </div>
      </BottomSheet>
    </AppShell>
  );
}
