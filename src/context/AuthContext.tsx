'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useUser, useClerk, useAuth as useClerkAuth, useSignIn, useSignUp } from '@clerk/nextjs';
import { calculateDobAge } from '@/lib/validation/dob';

export interface UserProfile {
  id: string;
  uid: string;
  clerkUserId?: string | null;
  username: string;
  usernameLower: string;
  fullName: string;
  displayName: string;
  email: string | null;
  role: 'USER' | 'ADMIN';
  membershipTier: 'FREE' | 'VIP' | string;
  is_vip: boolean;
  isVIP?: boolean;
  vipUsername?: string | null;
  vipUsernameClaimedAt?: string | null;
  vip_expires_at?: string | null;
  vip_started_at?: string | null;
  online: boolean;
  status: 'active' | 'suspended';
  profileCompleted: boolean;
  profileLocked?: boolean;
  genderDobLocked?: boolean;
  dateOfBirth?: string | null;
  gender: string;
  createdAt: number;
  updatedAt: number;
  profile: {
    bio: string;
    showBio?: boolean;
    dateOfBirth?: string | null;
    age: number;
    gender: string;
    showGender?: boolean;
    preferredGender?: string;
    personalityPreferences?: string;
    mood?: string;
    showMood?: boolean;
    moodExpiresAt?: string | null;
    language?: string;
    saveChatHistory?: boolean;
    interests: string;
    avatarType?: string;
    avatarEmoji?: string;
    avatarUrl?: string | null;
    themePreference: string;
    randomChatIntroSeen?: boolean;
    ageGenderConfirmed?: boolean;
    ageGenderChangesCount?: number;
    nameChangesCount?: number;
    profileCompleted?: boolean;
  };
  subscription?: {
    isActive: boolean;
    plan: string;
    endDate?: string;
  };
}

export type User = UserProfile;

interface AuthContextType {
  user: User | null;
  clerkUser: any | null;
  loading: boolean;
  isAuthenticated: boolean;
  loginWithGoogle: () => Promise<void>;
  signUpWithGoogle: () => Promise<void>;
  loginWithEmail: (emailOrUsername: string, pass: string) => Promise<void>;
  signUpWithEmail: (emailOrUsername: string, pass: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, user: clerkUser } = useUser();
  const clerk = useClerk();
  const { getToken } = useClerkAuth();
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const router = useRouter();
  const pathname = usePathname();

  // Protect against duplicate initialization per user session
  const currentInitUidRef = useRef<string | null>(null);
  const isNavigatingRef = useRef<boolean>(false);

  /**
   * Evaluates if the user profile has completed first-time onboarding
   */
  const checkProfileCompletion = (u: User | null): boolean => {
    if (!u) return false;
    return Boolean(
      u.profileCompleted === true &&
      u.username &&
      !u.username.startsWith('user_')
    );
  };

  /**
   * Initializes user profile from the canonical Clerk + Prisma backend (/api/auth/me)
   */
  const initializeUserSession = async (cUser: any): Promise<UserProfile | null> => {
    if (!cUser) {
      currentInitUidRef.current = null;
      setUser(null);
      return null;
    }

    if (currentInitUidRef.current === cUser.id && user) {
      return user;
    }
    currentInitUidRef.current = cUser.id;

    console.log('[AUTH] Clerk Profile initialization for ID:', cUser.id);
    try {
      const email = cUser.primaryEmailAddress?.emailAddress || null;
      const displayName = cUser.fullName || cUser.username || cUser.firstName || 'User';

      // Obtain verified Clerk session token if available
      const token = await getToken().catch(() => null);
      const authHeaders: Record<string, string> = {
        'x-clerk-user-id': cUser.id,
      };
      if (token) {
        authHeaders['Authorization'] = `Bearer ${token}`;
      }

      // Canonical backend DB (Prisma/Supabase) is the only profile source.
      const backendRes = await fetch('/api/auth/me', {
        headers: authHeaders,
        credentials: 'include',
      }).then((res) => (res.ok ? res.json() : null)).catch(() => null);

      const backendUser = backendRes?.user;

      const isProfileDone = Boolean(
        backendUser &&
        backendUser.username &&
        !backendUser.username.startsWith('user_') &&
        (backendUser.profileCompleted ||
         backendUser.profileLocked ||
         backendUser.genderDobLocked ||
         backendUser.profile?.profileCompleted ||
         backendUser.profile?.ageGenderConfirmed ||
         (backendUser.dob && backendUser.gender && backendUser.gender !== 'unspecified' && backendUser.fullName))
      );

      const resolvedProfile: UserProfile = {
        id: backendUser?.id || cUser.id,
        uid: cUser.id,
        clerkUserId: cUser.id,
        username: backendUser?.username || '',
        usernameLower: (backendUser?.username || '').toLowerCase(),
        vipUsername: backendUser?.vipUsername || null,
        vipUsernameClaimedAt: backendUser?.vipUsernameClaimedAt || null,
        fullName: backendUser?.fullName || displayName,
        displayName: backendUser?.displayName || displayName,
        email: backendUser?.email || email,
        role: (backendUser?.role as any) || 'USER',
        membershipTier: backendUser?.membershipTier || 'FREE',
        is_vip: Boolean(backendUser?.is_vip),
        isVIP: Boolean(backendUser?.is_vip),
        online: true,
        status: 'active' as const,
        profileCompleted: isProfileDone,
        profileLocked: isProfileDone,
        genderDobLocked: Boolean(backendUser?.genderDobLocked),
        dateOfBirth: backendUser?.dob || null,
        gender: backendUser?.gender || 'unspecified',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        profile: {
          bio: backendUser?.profile?.bio || 'Hey there! I am using CupidX.',
          age: backendUser?.dob ? calculateDobAge(backendUser.dob) : 18,
          dateOfBirth: backendUser?.dob || null,
          gender: backendUser?.gender || 'unspecified',
          themePreference: backendUser?.profile?.themePreference || 'purple',
          avatarType: backendUser?.profile?.avatarType || 'EMOJI',
          avatarEmoji: backendUser?.profile?.avatarEmoji || '😊',
          avatarUrl: backendUser?.profile?.avatarUrl || null,
          interests: backendUser?.profile?.interests || '',
          randomChatIntroSeen: backendUser?.profile?.randomChatIntroSeen ?? false,
          ageGenderConfirmed: Boolean(backendUser?.profile?.ageGenderConfirmed || backendUser?.genderDobLocked),
        },
        subscription: backendUser?.subscription || {
          isActive: false,
          plan: 'FREE',
        },
      };

      setUser(resolvedProfile);
      return resolvedProfile;
    } catch (err) {
      console.error('[AUTH] Profile load error:', err);
      return null;
    }
  };

  const refreshUser = useCallback(async () => {
    if (clerkUser) {
      currentInitUidRef.current = null;
      await initializeUserSession(clerkUser);
    }
  }, [clerkUser]);

  // ─── 1. Handle Clerk User State Changes ─────────────────────────────────────
  useEffect(() => {
    if (!isLoaded) return;

    if (isSignedIn && clerkUser) {
      initializeUserSession(clerkUser).then(() => {
        setLoading(false);
      });
    } else {
      setUser(null);
      currentInitUidRef.current = null;
      setLoading(false);
    }
  }, [isLoaded, isSignedIn, clerkUser]);

  // ─── 2. Route Guard ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoaded || loading) return;

    const publicPaths = [
      '/',
      '/login',
      '/register',
      '/signup',
      '/sign-in',
      '/sign-up',
      '/privacy',
      '/terms',
      '/safety',
      '/community-guidelines',
      '/refund',
      '/contact',
      '/sso-callback',
      '/auth-callback',
      '/forgot-password',
    ];
    const isPublic = publicPaths.some((p) => pathname === p || pathname.startsWith(p + '/'));

    const isAuthed = Boolean(isSignedIn && clerkUser);

    // Unauthenticated user on protected route -> redirect to /login
    if (!isAuthed && !isPublic) {
      if (isNavigatingRef.current) return;
      isNavigatingRef.current = true;
      console.log('[AUTH GUARD] Unauthenticated user on protected route -> redirecting to /login');
      router.replace('/login');
      setTimeout(() => { isNavigatingRef.current = false; }, 500);
      return;
    }

    // Authenticated user routing
    if (isAuthed) {
      const isComplete = checkProfileCompletion(user);

      const isAuthPage = [
        '/login',
        '/register',
        '/signup',
        '/sign-in',
        '/sign-up',
      ].some((p) => pathname === p || pathname.startsWith(p + '/'));

      const isSetupProfilePage = pathname === '/setup-profile' || pathname === '/onboarding';

      // Authenticated user visits sign-in / sign-up auth page -> route by profile state
      if (isAuthPage) {
        if (isNavigatingRef.current) return;
        isNavigatingRef.current = true;
        const target = isComplete ? '/chat' : '/setup-profile';
        console.log('[AUTH GUARD] Authenticated user on auth page -> redirecting to:', target);
        router.replace(target);
        setTimeout(() => { isNavigatingRef.current = false; }, 500);
        return;
      }

      // Authenticated user with completed profile visits /setup-profile -> redirect to /chat
      if (isSetupProfilePage && isComplete) {
        if (isNavigatingRef.current) return;
        isNavigatingRef.current = true;
        console.log('[AUTH GUARD] Profile already complete on setup-profile -> redirecting to /chat');
        router.replace('/chat');
        setTimeout(() => { isNavigatingRef.current = false; }, 500);
        return;
      }

      // Authenticated user with incomplete profile visits /chat or any protected route (other than /setup-profile) -> redirect to /setup-profile
      if (!isPublic && !isSetupProfilePage && !isComplete) {
        if (isNavigatingRef.current) return;
        isNavigatingRef.current = true;
        console.log('[AUTH GUARD] Incomplete profile on protected route -> redirecting to /setup-profile');
        router.replace('/setup-profile');
        setTimeout(() => { isNavigatingRef.current = false; }, 500);
        return;
      }
    }
  }, [isLoaded, loading, isSignedIn, clerkUser, user, pathname, router]);

  // ─── 3. Google 1-Click Sign-in via Clerk ────────────────────────────────────
  const loginWithGoogle = useCallback(async () => {
    console.log('[AUTH] Clerk Google login initiated');

    // 1. Primary: Use signIn.sso() — Clerk v7 Future API
    if (signIn?.sso) {
      try {
        const { error } = await signIn.sso({
          strategy: 'oauth_google',
          redirectUrl: '/auth-callback',
          redirectCallbackUrl: '/sso-callback',
        });
        if (error) {
          console.warn('[AUTH] signIn.sso error:', error);
        }
        return;
      } catch (ssoErr: any) {
        console.warn('[AUTH] signIn.sso notice:', ssoErr);
      }
    }

    // 2. Fallback: clerk.authenticateWithRedirect
    if (clerk && typeof (clerk as any).authenticateWithRedirect === 'function') {
      try {
        await (clerk as any).authenticateWithRedirect({
          strategy: 'oauth_google',
          redirectUrl: '/sso-callback',
          redirectUrlComplete: '/auth-callback',
          continueSignUpUrl: '/setup-profile',
        });
        return;
      } catch (authErr: any) {
        console.warn('[AUTH] clerk.authenticateWithRedirect notice:', authErr);
      }
    }

    // 3. Fallback: Open Clerk Sign-In modal
    if (clerk?.openSignIn) {
      try {
        clerk.openSignIn({
          fallbackRedirectUrl: '/auth-callback',
          signUpFallbackRedirectUrl: '/auth-callback',
        });
        return;
      } catch (modalErr) {
        console.warn('[AUTH] openSignIn modal notice:', modalErr);
      }
    }

    // 4. Last resort: clerk.redirectToSignIn
    if (clerk && typeof (clerk as any).redirectToSignIn === 'function') {
      await (clerk as any).redirectToSignIn({
        fallbackRedirectUrl: '/auth-callback',
        signUpFallbackRedirectUrl: '/auth-callback',
      });
    }
  }, [signIn, clerk]);

  const signUpWithGoogle = useCallback(async () => {
    console.log('[AUTH] Clerk Google signup initiated');

    // 1. Primary: Use signUp.sso() — Clerk v7 Future API
    if (signUp?.sso) {
      try {
        const { error } = await signUp.sso({
          strategy: 'oauth_google',
          redirectUrl: '/auth-callback',
          redirectCallbackUrl: '/sso-callback',
        });
        if (error) {
          console.warn('[AUTH] signUp.sso error:', error);
        }
        return;
      } catch (ssoErr: any) {
        console.warn('[AUTH] signUp.sso notice:', ssoErr);
      }
    }

    // 2. Secondary: Try signIn.sso() (auto-transfers)
    if (signIn?.sso) {
      try {
        const { error } = await signIn.sso({
          strategy: 'oauth_google',
          redirectUrl: '/auth-callback',
          redirectCallbackUrl: '/sso-callback',
        });
        if (error) {
          console.warn('[AUTH] signIn.sso error:', error);
        }
        return;
      } catch (ssoErr: any) {
        console.warn('[AUTH] signIn.sso notice:', ssoErr);
      }
    }

    // 3. Fallback: clerk.authenticateWithRedirect
    if (clerk && typeof (clerk as any).authenticateWithRedirect === 'function') {
      try {
        await (clerk as any).authenticateWithRedirect({
          strategy: 'oauth_google',
          redirectUrl: '/sso-callback',
          redirectUrlComplete: '/auth-callback',
          continueSignUpUrl: '/setup-profile',
        });
        return;
      } catch (authErr: any) {
        console.warn('[AUTH] clerk.authenticateWithRedirect notice:', authErr);
      }
    }

    // 4. Fallback: Open Clerk Sign-Up modal
    if (clerk?.openSignUp) {
      try {
        clerk.openSignUp({
          fallbackRedirectUrl: '/auth-callback',
        });
        return;
      } catch (modalErr) {
        console.warn('[AUTH] openSignUp modal notice:', modalErr);
      }
    }

    // 5. Last resort: clerk.redirectToSignUp
    if (clerk && typeof (clerk as any).redirectToSignUp === 'function') {
      await (clerk as any).redirectToSignUp({
        fallbackRedirectUrl: '/auth-callback',
      });
    }
  }, [signUp, signIn, clerk]);

  // ─── 4. Email / Password Login via Clerk ────────────────────────────────────
  const loginWithEmail = useCallback(async (emailOrUsername: string, pass: string) => {
    if (!clerk) {
      throw new Error('Sign-in service is initializing. Please try again.');
    }

    // If signIn hook isn't loaded yet, fall back to Clerk modal
    if (!signIn) {
      clerk.openSignIn({
        fallbackRedirectUrl: '/auth-callback',
        signUpFallbackRedirectUrl: '/auth-callback',
        initialValues: {
          emailAddress: emailOrUsername.includes('@') ? emailOrUsername : undefined,
        },
      });
      return;
    }

    try {
      const isEmail = emailOrUsername.includes('@');
      // Clerk v7: create() returns { error }, status on signIn.status
      const { error: createError } = await signIn.create({
        identifier: emailOrUsername.trim(),
        password: pass,
      });

      if (createError) {
        const msg = (createError as any)?.longMessage || (createError as any)?.message || 'Invalid email or password.';
        throw new Error(msg);
      }

      if (signIn.status === 'complete') {
        // Clerk v7: finalize() converts completed sign-in into active session
        const { error: finalizeError } = await signIn.finalize();
        if (finalizeError) {
          console.warn('[AUTH] signIn.finalize error:', finalizeError);
        }
        // Navigate to auth-callback router — evaluates profile state on server
        router.replace('/auth-callback');
      } else {
        console.warn('[AUTH] Incomplete sign-in status:', signIn.status);
        clerk.openSignIn({
          fallbackRedirectUrl: '/auth-callback',
          signUpFallbackRedirectUrl: '/auth-callback',
          initialValues: {
            emailAddress: emailOrUsername.includes('@') ? emailOrUsername : undefined,
          },
        });
      }
    } catch (err: any) {
      console.error('[AUTH] Clerk login error:', err);
      const msg = err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || err?.message || 'Invalid email or password.';
      throw new Error(msg);
    }
  }, [clerk, signIn, router]);

  // ─── 5. Email / Password Signup via Clerk ───────────────────────────────────
  const signUpWithEmail = useCallback(async (emailOrUsername: string, pass: string, name?: string) => {
    if (!clerk) {
      throw new Error('Sign-up service is initializing. Please try again.');
    }

    // If signUp hook isn't loaded yet, fall back to Clerk modal
    if (!signUp) {
      clerk.openSignUp({
        fallbackRedirectUrl: '/auth-callback',
        initialValues: {
          emailAddress: emailOrUsername.includes('@') ? emailOrUsername : undefined,
          firstName: name || undefined,
        },
      });
      return;
    }

    try {
      const isEmail = emailOrUsername.includes('@');
      // Clerk v7: create() returns { error }, status on signUp.status
      const { error: createError } = await signUp.create({
        emailAddress: isEmail ? emailOrUsername.trim() : undefined,
        username: !isEmail ? emailOrUsername.trim().toLowerCase().replace(/[^a-z0-9_]/g, '') : undefined,
        password: pass,
        firstName: name || undefined,
      });

      if (createError) {
        const msg = (createError as any)?.longMessage || (createError as any)?.message || 'Could not complete registration.';
        throw new Error(msg);
      }

      if (signUp.status === 'complete') {
        // Clerk v7: finalize() converts completed sign-up into active session
        const { error: finalizeError } = await signUp.finalize();
        if (finalizeError) {
          console.warn('[AUTH] signUp.finalize error:', finalizeError);
        }
        // Navigate to setup-profile after session is active
        router.replace('/setup-profile');
      } else {
        console.warn('[AUTH] Sign-up requires additional verification:', signUp.status);
        clerk.openSignUp({
          fallbackRedirectUrl: '/auth-callback',
          initialValues: {
            emailAddress: isEmail ? emailOrUsername.trim() : undefined,
            firstName: name || undefined,
          },
        });
      }
    } catch (err: any) {
      console.error('[AUTH] Clerk signup error:', err);
      const msg = err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || err?.message || 'Could not complete registration.';
      throw new Error(msg);
    }
  }, [clerk, signUp, router]);

  // ─── 6. Logout via Clerk ───────────────────────────────────────────────────
  const logout = useCallback(async () => {
    try {
      try {
        await fetch('/api/auth/logout', { method: 'POST' });
      } catch (logoutApiErr) {
        console.warn('[AUTH] Logout API clearance notice:', logoutApiErr);
      }

      setUser(null);
      currentInitUidRef.current = null;

      if (clerk) {
        await clerk.signOut();
      }
      router.replace('/login');
    } catch (e) {
      console.error('[AUTH] Logout error:', e);
      router.replace('/login');
    }
  }, [clerkUser, clerk, router]);

  const isAuthenticated = Boolean(isSignedIn && clerkUser);

  const contextValue = useMemo<AuthContextType>(
    () => ({
      user,
      clerkUser,
      loading: !isLoaded || loading,
      isAuthenticated,
      loginWithGoogle,
      signUpWithGoogle,
      loginWithEmail,
      signUpWithEmail,
      logout,
      refreshUser,
    }),
    [
      user,
      clerkUser,
      isLoaded,
      loading,
      isAuthenticated,
      loginWithGoogle,
      signUpWithGoogle,
      loginWithEmail,
      signUpWithEmail,
      logout,
      refreshUser,
    ]
  );

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
