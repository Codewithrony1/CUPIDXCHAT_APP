'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useUser, useAuth as useClerkAuth } from '@clerk/nextjs';
import { calculateDobAge as calculateAge } from '@/lib/validation/dob';
import { validateDob, MIN_DOB_STRING, getTodayDateString } from '@/lib/validation/dob';
import { Heart, User, Calendar, Smile, ArrowRight, ShieldCheck, CheckCircle2, Loader2, Clock, AtSign } from 'lucide-react';
import FloatingHearts from '@/components/FloatingHearts';

export default function OnboardingPage() {
  const router = useRouter();
  const { user, clerkUser, loading: authLoading, refreshUser } = useAuth();
  const { user: directClerkUser } = useUser();
  const { getToken } = useClerkAuth();

  const [username, setUsername] = useState('');
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameError, setUsernameError] = useState<string>('');
  const [displayName, setDisplayName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other' | 'prefer_not_to_say'>('male');
  const [selectedEmoji, setSelectedEmoji] = useState('😊');

  // Real-time Debounced Username Availability Check
  useEffect(() => {
    let active = true;
    const clean = username.trim().toLowerCase().replace(/^@/, '');
    if (!clean) {
      setUsernameAvailable(null);
      setUsernameError('');
      return;
    }
    if (clean.length < 3) {
      setUsernameAvailable(false);
      setUsernameError('Username must be at least 3 characters');
      return;
    }
    if (clean.length > 20) {
      setUsernameAvailable(false);
      setUsernameError('Username cannot exceed 20 characters');
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(clean)) {
      setUsernameAvailable(false);
      setUsernameError('Only letters, numbers, and underscores allowed');
      return;
    }

    setUsernameChecking(true);
    setUsernameError('');
    const timer = setTimeout(async () => {
      try {
        const token = await getToken().catch(() => null);
        const headers: Record<string, string> = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        const effectiveClerkId = directClerkUser?.id || clerkUser?.id || user?.clerkUserId;
        if (effectiveClerkId) {
          headers['x-clerk-user-id'] = effectiveClerkId;
        }

        const res = await fetch(`/api/auth/onboarding?username=${encodeURIComponent(clean)}`, {
          headers,
          credentials: 'include',
        });

        const data = await res.json().catch(() => ({}));
        if (!active) return;

        if (!res.ok) {
          setUsernameAvailable(false);
          if (res.status === 429) {
            setUsernameError('Too many checks. Please wait a moment.');
          } else {
            setUsernameError(
              data?.reason || data?.error || 'Unable to verify username right now. Please try again.'
            );
          }
          return;
        }

        if (data?.available) {
          setUsernameAvailable(true);
          setUsernameError('');
        } else {
          setUsernameAvailable(false);
          setUsernameError(data?.reason || 'Username is already taken');
        }
      } catch {
        if (active) {
          setUsernameAvailable(false);
          setUsernameError('Network error checking username. Please try again.');
        }
      } finally {
        if (active) {
          setUsernameChecking(false);
        }
      }
    }, 350);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [username, getToken, directClerkUser?.id, clerkUser?.id, user?.clerkUserId]);

  // Consent & Privacy State
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAcknowledged, setPrivacyAcknowledged] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [randomChatAcknowledged, setRandomChatAcknowledged] = useState(false);
  const [locationProcessingAcknowledged, setLocationProcessingAcknowledged] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);

  // 48-Hour Deletion Lock Cooldown State
  const [isDeletionLocked, setIsDeletionLocked] = useState(false);
  const [deletionLockRemainingHours, setDeletionLockRemainingHours] = useState<number | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Check 48-Hour Deletion Lock on Mount
  useEffect(() => {
    async function checkLockStatus() {
      try {
        const res = await fetch('/api/auth/me');
        if (res.status === 403) {
          const data = await res.json().catch(() => ({}));
          if (data?.isDeletionLocked) {
            setIsDeletionLocked(true);
            setDeletionLockRemainingHours(data.remainingHours || 48);
            setErrorMsg(
              data.error ||
                'Your previous account was recently deleted. For security reasons, you can create a new CupidxChat account after the temporary 48-hour restriction expires.'
            );
          }
        }
      } catch (e) {}
    }
    checkLockStatus();
  }, []);

  // Pre-fill existing data if available
  useEffect(() => {
    const activeName =
      (user?.fullName && user.fullName !== 'CupidX User' ? user.fullName : null) ||
      (user?.displayName && user.displayName !== 'CupidX User' ? user.displayName : null) ||
      directClerkUser?.fullName ||
      clerkUser?.fullName ||
      directClerkUser?.firstName ||
      '';

    if (activeName && !displayName) {
      setDisplayName(activeName);
    }

    const suggestedUsername =
      (user?.username && !user.username.startsWith('user_') && !user.username.includes('_') ? user.username : null) ||
      (directClerkUser?.username || clerkUser?.username || '') ||
      (user?.email ? user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20) : '') ||
      '';

    if (suggestedUsername && !username) {
      setUsername(suggestedUsername);
    }

    if (user) {
      if (user.dateOfBirth || user.profile?.dateOfBirth) {
        setDateOfBirth(user.dateOfBirth || user.profile?.dateOfBirth || '');
      }

      if (user.gender && user.gender !== 'unspecified') {
        setGender(user.gender as any);
      } else if (user.profile?.gender && user.profile.gender !== 'unspecified') {
        setGender(user.profile.gender as any);
      }

      if (user.profile?.avatarEmoji) {
        setSelectedEmoji(user.profile.avatarEmoji);
      }
    }
  }, [user, directClerkUser, clerkUser]);

  const isProfileComplete = Boolean(
    user &&
    user.username &&
    !user.username.startsWith('user_') &&
    (user.profileCompleted ||
     (user as any)?.genderDobLocked ||
     user?.profile?.ageGenderConfirmed ||
     ((user?.dateOfBirth || user?.profile?.dateOfBirth) && user?.gender && user?.gender !== 'unspecified' && (user?.fullName || user?.displayName)))
  );

  // If not authenticated, redirect to login only after auth has loaded
  useEffect(() => {
    if (!authLoading && !user && !directClerkUser && !clerkUser) {
      router.replace('/login');
    }
  }, [authLoading, user, directClerkUser, clerkUser, router]);

  // If already complete, redirect to /chat
  useEffect(() => {
    if (!authLoading && user) {
      if (isProfileComplete && !submitting) {
        router.replace('/chat');
      }
    }
  }, [user, authLoading, isProfileComplete, submitting, router]);

  // Calculated dynamic age
  const dynamicAge = dateOfBirth ? calculateAge(dateOfBirth) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const cleanUsername = username.trim().toLowerCase().replace(/^@/, '');
    if (!cleanUsername) {
      setErrorMsg('Please enter a username.');
      return;
    }
    if (cleanUsername.length < 3 || cleanUsername.length > 20) {
      setErrorMsg('Username must be between 3 and 20 characters.');
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(cleanUsername)) {
      setErrorMsg('Username can only contain letters, numbers, and underscores.');
      return;
    }
    if (usernameAvailable === false) {
      setErrorMsg(usernameError || 'Please choose an available username.');
      return;
    }

    if (!displayName.trim()) {
      setErrorMsg('Please enter your full name.');
      return;
    }

    // Authoritative Client-side DOB & 18+ Age Validation
    const dobValidation = validateDob(dateOfBirth);
    if (!dobValidation.valid) {
      setErrorMsg(dobValidation.error || 'Please enter a valid date of birth.');
      return;
    }

    if (!gender) {
      setErrorMsg('Please select your gender.');
      return;
    }

    if (
      !termsAccepted ||
      !privacyAcknowledged ||
      !ageConfirmed ||
      !randomChatAcknowledged ||
      !locationProcessingAcknowledged
    ) {
      setErrorMsg('Please accept all required confirmations to continue.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      const token = await getToken().catch(() => null);

      // Direct authoritative API call to complete onboarding and permanently lock identity
      const res = await fetch('/api/auth/onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          username: cleanUsername,
          displayName: displayName.trim(),
          dob: dateOfBirth,
          gender,
          avatarEmoji: selectedEmoji,
          termsAccepted,
          privacyAcknowledged,
          ageConfirmed,
          randomChatAcknowledged,
          locationProcessingAcknowledged,
          marketingConsent,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (data?.isDeletionLocked) {
          setIsDeletionLocked(true);
          setDeletionLockRemainingHours(data.remainingHours || 48);
        }
        if (data?.error?.toLowerCase().includes('username')) {
          setUsernameAvailable(false);
          setUsernameError(data.error);
        }
        setErrorMsg(data.error || 'Failed to complete profile setup. Please check your information and try again.');
        setSubmitting(false);
        return;
      }

      await refreshUser();
      router.replace('/chat');
    } catch (err: any) {
      console.error('Onboarding save error:', err);
      setErrorMsg(err?.message || 'Failed to complete profile setup. Please try again.');
      setSubmitting(false);
    }
  };

  if (authLoading || (user && isProfileComplete && !submitting)) {
    return (
      <div className="min-h-screen bg-[#0d0014] text-white flex flex-col justify-center items-center p-4 relative overflow-hidden">
        <FloatingHearts />
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-pink-600 via-rose-500 to-fuchsia-500 flex items-center justify-center shadow-xl shadow-pink-500/40 animate-pulse z-10">
          <Heart className="w-7 h-7 text-white fill-white" />
        </div>
        <div className="flex items-center space-x-2 text-pink-300 text-xs font-bold mt-4 z-10">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>{isProfileComplete ? 'Opening chat...' : 'Loading CupidX...'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0014] text-white flex flex-col justify-center items-center p-4 relative overflow-x-hidden selection:bg-pink-500 selection:text-white">
      <FloatingHearts />

      <div className="w-full max-w-md glass-romantic rounded-3xl p-6 sm:p-8 space-y-6 z-10 border border-pink-500/30 shadow-2xl shadow-pink-500/20 my-6 backdrop-blur-xl">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-pink-600 via-rose-500 to-fuchsia-500 flex items-center justify-center mx-auto shadow-lg shadow-pink-500/40">
            <Heart className="w-7 h-7 text-white fill-white animate-pulse" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">Let&apos;s set up your profile</h1>
          <p className="text-xs text-pink-200/80">Tell us a little about yourself before you start connecting.</p>
        </div>

        {/* 48-Hour Deletion Cooldown Alert Banner */}
        {isDeletionLocked && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-2 leading-relaxed animate-in fade-in">
            <div className="flex items-center gap-2 font-bold text-amber-300">
              <Clock className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Temporary 48-Hour Re-Registration Restriction</span>
            </div>
            <p>
              Your previous account was recently deleted. For security reasons, you can create a new CupidxChat account after the temporary 48-hour restriction expires.
            </p>
            {deletionLockRemainingHours && (
              <p className="text-[11px] text-amber-300/80 font-mono">
                Cooldown remaining: ~{deletionLockRemainingHours} hour{deletionLockRemainingHours > 1 ? 's' : ''}
              </p>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* 0. Choose Username */}
            <div className="space-y-1.5 text-left">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-pink-200 flex items-center gap-1.5">
                  <AtSign className="w-3.5 h-3.5 text-pink-400" />
                  <span>USERNAME</span>
                </label>
                {usernameChecking && (
                  <span className="text-[11px] font-semibold text-pink-300 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Checking...
                  </span>
                )}
                {!usernameChecking && usernameAvailable === true && (
                  <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Available
                  </span>
                )}
                {!usernameChecking && usernameAvailable === false && (
                  <span className="text-[11px] font-bold text-rose-400 flex items-center gap-1">
                    {usernameError || 'Unavailable'}
                  </span>
                )}
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-pink-400/80 font-bold text-sm">
                  @
                </div>
                <input
                  type="text"
                  required
                  placeholder="cupid_lover"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                  className="w-full pl-8 pr-4 py-3 rounded-2xl glass-input text-xs sm:text-sm text-white placeholder:text-pink-300/40 focus:outline-none focus:ring-1 focus:ring-pink-500 font-semibold lowercase"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={20}
                />
              </div>
              <p className="text-[10px] text-pink-200/50">3–20 characters (letters, numbers, and underscores). Your unique handle on CupidX.</p>
            </div>

            {/* 1. Full Name */}
            <div className="space-y-1.5 text-left">
              <label className="text-xs font-bold text-pink-200 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-pink-400" />
                <span>FULL NAME</span>
              </label>
              <input
                type="text"
                required
                placeholder="John Smith"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl glass-input text-xs sm:text-sm text-white placeholder:text-pink-300/40 focus:outline-none focus:ring-1 focus:ring-pink-500 font-semibold"
              />
            </div>

            {/* 2. Date of Birth */}
            <div className="space-y-1.5 text-left">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-pink-200 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-purple-400" />
                  <span>DATE OF BIRTH</span>
                </label>
                {dynamicAge !== null && dynamicAge >= 18 && (
                  <span className="text-[11px] font-extrabold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/30">
                    Age: {dynamicAge} yrs
                  </span>
                )}
                {dynamicAge !== null && dynamicAge > 0 && dynamicAge < 18 && (
                  <span className="text-[11px] font-extrabold text-rose-400 bg-rose-500/15 px-2 py-0.5 rounded-full border border-rose-500/30">
                    Age: {dynamicAge} yrs (Under 18)
                  </span>
                )}
              </div>
              <input
                type="date"
                required
                min={MIN_DOB_STRING}
                max={getTodayDateString()}
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl glass-input text-xs sm:text-sm text-white focus:outline-none focus:ring-1 focus:ring-pink-500 font-semibold cursor-pointer"
              />
              <p className="text-[10px] text-pink-200/50">Must be at least 18 years old (January 1, 1950 through Today). DOB is permanently locked once saved.</p>
            </div>

            {/* 3. Gender */}
            <div className="space-y-1.5 text-left">
              <label className="text-xs font-bold text-pink-200 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-pink-400" />
                <span>GENDER</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Male', val: 'male' },
                  { label: 'Female', val: 'female' },
                  { label: 'Other', val: 'other' },
                ].map((item) => (
                  <button
                    key={item.val}
                    type="button"
                    onClick={() => setGender(item.val as any)}
                    className={`py-2.5 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      gender === item.val
                        ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white border-pink-400 shadow-md scale-[1.02]'
                        : 'bg-white/5 border-white/10 text-pink-200/70 hover:bg-white/10'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 4. Choose Avatar Emoji */}
            <div className="space-y-1.5 text-left pt-1">
              <label className="text-xs font-bold text-pink-200 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Smile className="w-3.5 h-3.5 text-pink-400" />
                  <span>Choose Avatar Emoji</span>
                </span>
                <span className="text-[10px] text-pink-300/60 font-semibold">2 Free</span>
              </label>

              <div className="p-3 rounded-2xl bg-white/5 border border-pink-500/20 flex items-center justify-center space-x-4">
                {['😊', '😎'].map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setSelectedEmoji(emoji)}
                    className={`w-12 h-12 rounded-2xl text-2xl flex items-center justify-center transition-all cursor-pointer select-none ${
                      selectedEmoji === emoji
                        ? 'bg-gradient-to-tr from-pink-600 to-rose-500 border-2 border-pink-300 shadow-xl scale-110'
                        : 'bg-white/5 hover:bg-white/10 border border-white/10 opacity-60 hover:opacity-100'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* 5. Privacy & Consent Acknowledgements */}
            <div className="space-y-3 pt-3 border-t border-pink-500/20 text-left">
              <div className="flex items-center gap-1.5 text-xs font-bold text-pink-200">
                <ShieldCheck className="w-3.5 h-3.5 text-pink-400" />
                <span>PRIVACY &amp; CONSENT</span>
              </div>

              {/* Inline Consent Validation Error */}
              {errorMsg === 'Please accept all required confirmations to continue.' && (
                <div className="p-3 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-xs text-rose-300 font-bold text-center leading-relaxed animate-in fade-in">
                  Please accept all required confirmations to continue.
                </div>
              )}

              <div className="space-y-2.5 text-[11px] sm:text-xs text-pink-100/90 leading-snug">
                {/* 1. Terms & Conditions */}
                <label className="flex items-start gap-2.5 cursor-pointer group select-none">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-pink-500/40 bg-white/5 text-pink-600 focus:ring-pink-500 focus:ring-offset-0 transition-all cursor-pointer shrink-0"
                  />
                  <span>
                    I agree to the{' '}
                    <Link
                      href="/terms"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-pink-300 underline font-semibold hover:text-white"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Terms &amp; Conditions
                    </Link>
                    . <span className="text-rose-400 font-bold">*</span>
                  </span>
                </label>

                {/* 2. Privacy Policy */}
                <label className="flex items-start gap-2.5 cursor-pointer group select-none">
                  <input
                    type="checkbox"
                    checked={privacyAcknowledged}
                    onChange={(e) => setPrivacyAcknowledged(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-pink-500/40 bg-white/5 text-pink-600 focus:ring-pink-500 focus:ring-offset-0 transition-all cursor-pointer shrink-0"
                  />
                  <span>
                    I acknowledge that I have read and understood the{' '}
                    <Link
                      href="/privacy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-pink-300 underline font-semibold hover:text-white"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Privacy Policy
                    </Link>
                    . <span className="text-rose-400 font-bold">*</span>
                  </span>
                </label>

                {/* 3. Age Requirement */}
                <label className="flex items-start gap-2.5 cursor-pointer group select-none">
                  <input
                    type="checkbox"
                    checked={ageConfirmed}
                    onChange={(e) => setAgeConfirmed(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-pink-500/40 bg-white/5 text-pink-600 focus:ring-pink-500 focus:ring-offset-0 transition-all cursor-pointer shrink-0"
                  />
                  <span>
                    I confirm that I meet the minimum age requirement (18+) to use CupidX. <span className="text-rose-400 font-bold">*</span>
                  </span>
                </label>

                {/* 4. Random Stranger Chat */}
                <label className="flex items-start gap-2.5 cursor-pointer group select-none">
                  <input
                    type="checkbox"
                    checked={randomChatAcknowledged}
                    onChange={(e) => setRandomChatAcknowledged(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-pink-500/40 bg-white/5 text-pink-600 focus:ring-pink-500 focus:ring-offset-0 transition-all cursor-pointer shrink-0"
                  />
                  <span>
                    I understand that CupidX is a random-chat service and that I may be connected with strangers. <span className="text-rose-400 font-bold">*</span>
                  </span>
                </label>

                {/* 5. Technical & Country Processing */}
                <label className="flex items-start gap-2.5 cursor-pointer group select-none">
                  <input
                    type="checkbox"
                    checked={locationProcessingAcknowledged}
                    onChange={(e) => setLocationProcessingAcknowledged(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-pink-500/40 bg-white/5 text-pink-600 focus:ring-pink-500 focus:ring-offset-0 transition-all cursor-pointer shrink-0"
                  />
                  <span>
                    I understand that CupidX may process technical information such as IP-derived approximate country information to provide features such as country display, security, abuse prevention, and service operation, as described in the Privacy Policy. <span className="text-rose-400 font-bold">*</span>
                  </span>
                </label>

                {/* Optional Marketing */}
                <div className="pt-2 border-t border-white/5">
                  <div className="text-[10px] uppercase tracking-wider font-extrabold text-pink-300/60 mb-1">
                    Optional
                  </div>
                  <label className="flex items-start gap-2.5 cursor-pointer group select-none">
                    <input
                      type="checkbox"
                      checked={marketingConsent}
                      onChange={(e) => setMarketingConsent(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-pink-500/40 bg-white/5 text-pink-600 focus:ring-pink-500 focus:ring-offset-0 transition-all cursor-pointer shrink-0"
                    />
                    <span className="text-pink-200/70 group-hover:text-pink-100 transition-colors">
                      I would like to receive product updates / announcements from CupidX.
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-2xl bg-rose-500/20 border border-rose-500/30 text-xs text-rose-300 font-bold text-center leading-relaxed">
                {errorMsg}
              </div>
            )}

            {/* Primary Submit Button */}
            <button
              type="submit"
              disabled={submitting || isDeletionLocked}
              className="w-full py-4 rounded-2xl font-black bg-gradient-to-r from-pink-600 via-rose-500 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white shadow-xl shadow-pink-500/30 flex items-center justify-center space-x-2 text-sm disabled:opacity-50 transition-all cursor-pointer active:scale-95"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

      </div>
    </div>
  );
}
