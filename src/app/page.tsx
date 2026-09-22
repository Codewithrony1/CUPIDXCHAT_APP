'use client';

export const dynamic = 'force-dynamic';

import nextDynamic from 'next/dynamic';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Heart, Shield, User, MessageCircle, Lock, ArrowRight, FastForward, CheckCircle2, Sparkles, Crown, X } from 'lucide-react';
import FloatingHearts from '@/components/FloatingHearts';
import CupidXLogo from '@/components/CupidXLogo';
import { useAuth } from '@/context/AuthContext';

const Canvas3D = nextDynamic(() => import('@/components/Canvas3D'), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-[#120019] -z-10 animate-pulse" />,
});

export default function Home() {
  const { user, loading } = useAuth();

  const isAuthenticated = !loading && !!user;
  const needsOnboarding = isAuthenticated && user && (!user.profileCompleted || !user.username || user.username.startsWith('user_'));

  // Authentication-aware routing URLs
  const startChattingUrl = isAuthenticated
    ? needsOnboarding
      ? '/setup-profile'
      : '/chat'
    : '/login';

  const loginUrl = isAuthenticated
    ? needsOnboarding
      ? '/setup-profile'
      : '/chat'
    : '/login';

  const joinNowUrl = isAuthenticated
    ? needsOnboarding
      ? '/setup-profile'
      : '/chat'
    : '/signup';

  return (
    <div className="relative min-h-screen flex flex-col justify-between overflow-x-hidden selection:bg-pink-500 selection:text-white bg-[#0d0014]">
      {/* 3D Animated Background */}
      <Canvas3D />
      <FloatingHearts />

      {/* Header */}
      <header className="w-full max-w-6xl mx-auto px-3 sm:px-6 py-4 flex justify-between items-center z-10">
        <Link href="/" className="flex items-center group shrink-0">
          <CupidXLogo size="md" />
        </Link>
        
        <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
          <Link
            href={loginUrl}
            className="px-3.5 py-2 sm:px-5 sm:py-2.5 rounded-xl sm:rounded-2xl text-xs font-bold text-pink-200 hover:text-white transition-all bg-white/5 hover:bg-white/10 border border-pink-500/30 backdrop-blur-md whitespace-nowrap cursor-pointer"
          >
            Log In
          </Link>
          <Link
            href={joinNowUrl}
            className="px-3.5 py-2 sm:px-5 sm:py-2.5 rounded-xl sm:rounded-2xl text-xs font-bold bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 text-white shadow-lg shadow-pink-500/30 flex items-center gap-1 sm:gap-1.5 transition-all hover:scale-105 active:scale-95 whitespace-nowrap cursor-pointer"
          >
            <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Join Now</span>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-grow flex flex-col items-center justify-center px-4 sm:px-6 py-10 text-center max-w-4xl mx-auto z-10 relative space-y-12">
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="space-y-6"
        >
          {/* Badge */}
          <div className="inline-flex items-center space-x-2 px-5 py-2 rounded-full bg-gradient-to-r from-pink-500/20 to-purple-500/20 border border-pink-400/40 text-pink-300 text-xs font-extrabold uppercase tracking-widest shadow-lg shadow-pink-500/20 backdrop-blur-md">
            <Lock className="w-3.5 h-3.5 text-pink-400" />
            <span>Privacy-First Ephemeral Messaging</span>
          </div>

          {/* Heading */}
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tight leading-none text-white drop-shadow-2xl">
            Meet. Chat.{' '}
            <span className="bg-gradient-to-r from-pink-400 via-rose-400 to-fuchsia-400 bg-clip-text text-transparent text-glow-pink">
              Move on.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg text-pink-100/90 max-w-xl mx-auto font-normal leading-relaxed">
            Private, simple 1-to-1 conversations without unnecessary chat history. When you press <span className="font-bold text-white">NEXT</span>, messages are permanently erased.
          </p>

          {/* CTAs */}
          <div className="flex justify-center pt-4 w-full max-w-sm mx-auto">
            <Link
              href={startChattingUrl}
              className="w-full py-5 rounded-3xl font-black bg-gradient-to-r from-pink-600 via-rose-500 to-fuchsia-600 hover:from-pink-500 hover:to-fuchsia-500 text-white shadow-2xl shadow-pink-500/50 hover:scale-105 active:scale-95 transition-all text-xl flex items-center justify-center space-x-3 border border-pink-400/40 glow-pink-lg group cursor-pointer"
            >
              <Heart className="w-7 h-7 fill-white animate-bounce" />
              <span>START CHATTING</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </motion.div>

        {/* How It Works Section */}
        <motion.div
          initial={{ opacity: 0, y: 35 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="w-full space-y-6 text-left"
        >
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-black text-white">How It Works</h2>
            <p className="text-xs text-pink-200/70">Connect, talk, and move forward in 4 simple steps</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="glass-romantic rounded-3xl p-5 space-y-2 border border-pink-500/20">
              <span className="w-8 h-8 rounded-2xl bg-pink-500/20 text-pink-400 font-black text-sm flex items-center justify-center border border-pink-500/30">1</span>
              <h4 className="text-sm font-bold text-white">Create Account</h4>
              <p className="text-pink-200/70 text-xs leading-relaxed">Sign up and pick a unique @username for your profile.</p>
            </div>

            <div className="glass-romantic rounded-3xl p-5 space-y-2 border border-pink-500/20">
              <span className="w-8 h-8 rounded-2xl bg-pink-500/20 text-pink-400 font-black text-sm flex items-center justify-center border border-pink-500/30">2</span>
              <h4 className="text-sm font-bold text-white">Instant Match</h4>
              <p className="text-pink-200/70 text-xs leading-relaxed">Click START CHATTING to instantly join the romantic match queue.</p>
            </div>

            <div className="glass-romantic rounded-3xl p-5 space-y-2 border border-pink-500/20">
              <span className="w-8 h-8 rounded-2xl bg-pink-500/20 text-pink-400 font-black text-sm flex items-center justify-center border border-pink-500/30">3</span>
              <h4 className="text-sm font-bold text-white">Chat Instantly</h4>
              <p className="text-pink-200/70 text-xs leading-relaxed">Exchange real-time text messages and emojis safely.</p>
            </div>

            <div className="glass-romantic rounded-3xl p-5 space-y-2 border border-pink-500/20">
              <span className="w-8 h-8 rounded-2xl bg-pink-500/20 text-pink-400 font-black text-sm flex items-center justify-center border border-pink-500/30">4</span>
              <h4 className="text-sm font-bold text-white">Press NEXT</h4>
              <p className="text-pink-200/70 text-xs leading-relaxed">When done, press NEXT. The active chat session terminates and messages are cleared immediately.</p>
            </div>
          </div>
        </motion.div>

        {/* FREE vs VIP Membership Comparison */}
        <motion.div
          initial={{ opacity: 0, y: 35 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="w-full space-y-6 text-center pt-6"
        >
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-yellow-500/15 border border-yellow-500/30 text-yellow-300 text-[11px] font-black uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 fill-current" />
              <span>Membership Comparison</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white">Why 94% of Users Choose VIP</h2>
            <p className="text-xs sm:text-sm text-pink-200/80 max-w-md mx-auto">
              Unlock total chat personalization, target gender matching, and custom profiles for less than ₹1/day!
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left max-w-3xl mx-auto pt-2">
            
            {/* FREE TIER CARD */}
            <div className="glass rounded-3xl p-6 space-y-5 border border-white/10 relative flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div>
                    <h3 className="text-xl font-black text-white">CUPIDX FREE</h3>
                    <p className="text-xs text-pink-200/60 font-semibold">Standard Ephemeral Chat</p>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black text-white">₹0</span>
                    <span className="text-xs text-pink-200/60 block font-normal">Forever Free</span>
                  </div>
                </div>

                <ul className="space-y-2.5 text-xs text-pink-200/80">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Unlimited 1-to-1 Ephemeral Random Chat</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Instant NEXT Partner Switching</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Standard Avatar Emojis & @username Profile</span>
                  </li>
                  <li className="flex items-center gap-2 text-pink-200/50">
                    <Lock className="w-4 h-4 text-rose-400/80 shrink-0" />
                    <span className="line-through">Custom Profile Picture & DP Uploads</span>
                    <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">VIP ONLY</span>
                  </li>
                  <li className="flex items-center gap-2 text-pink-200/50">
                    <Lock className="w-4 h-4 text-rose-400/80 shrink-0" />
                    <span className="line-through">Target Gender Match Preferences</span>
                    <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">VIP ONLY</span>
                  </li>
                </ul>
              </div>

              <Link
                href={joinNowUrl}
                className="w-full py-3.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs text-center border border-white/20 transition-colors block mt-4"
              >
                START FOR FREE
              </Link>
            </div>

            {/* VIP TIER CARD */}
            <div className="glass-romantic rounded-3xl p-6 space-y-5 border border-yellow-500/40 relative flex flex-col justify-between bg-gradient-to-b from-yellow-950/20 via-pink-950/20 to-slate-950 shadow-xl shadow-yellow-500/10">
              <div className="absolute -top-3 right-4 bg-gradient-to-r from-yellow-500 to-amber-500 text-slate-950 font-black text-[10px] uppercase tracking-wider px-3 py-1 rounded-full shadow-md border border-yellow-300">
                RECOMMENDED
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-yellow-500/20 pb-3 pt-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xl font-black text-white">💎 CUPIDX VIP</span>
                    </div>
                    <p className="text-[11px] text-yellow-300 font-bold">Best Romantic Connections</p>
                  </div>

                  <div className="text-right">
                    <div className="text-2xl font-black text-yellow-400 flex items-baseline justify-end gap-1">
                      <span>₹29</span>
                      <span className="text-xs text-yellow-200/80 font-normal">/mo</span>
                    </div>
                    <span className="text-[10px] text-emerald-400 font-semibold block">Monthly Plan</span>
                  </div>
                </div>

                <ul className="space-y-2.5 text-xs text-white">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-yellow-400 shrink-0 fill-yellow-400/20" />
                    <span className="font-semibold">Custom Profile Picture & DP Uploads</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-yellow-400 shrink-0 fill-yellow-400/20" />
                    <span className="font-semibold">Target Match Preferences (Men / Women / Anyone)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-yellow-400 shrink-0 fill-yellow-400/20" />
                    <span className="font-semibold">Custom Bio, Moods & Expiration Timers</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-yellow-400 shrink-0 fill-yellow-400/20" />
                    <span className="font-semibold">Personality Tags & Smart Priority Matching</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-yellow-400 shrink-0 fill-yellow-400/20" />
                    <span className="font-semibold">💎 Exclusive VIP Badge on Profile & Chat</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-yellow-400 shrink-0 fill-yellow-400/20" />
                    <span className="font-semibold">Direct Priority Support & Ad-Free Experience</span>
                  </li>
                </ul>
              </div>

              <Link
                href="/vip"
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-yellow-500 via-amber-500 to-yellow-600 hover:from-yellow-400 hover:to-amber-500 text-slate-950 font-black text-xs text-center shadow-lg shadow-yellow-500/30 transition-all hover:scale-102 active:scale-95 block mt-4 border border-yellow-300/40 cursor-pointer uppercase tracking-wider"
              >
                UNLOCK VIP NOW — ₹29 / MONTH
              </Link>
            </div>

          </div>
        </motion.div>

        {/* Privacy Highlight Banner */}
        <motion.div
          initial={{ opacity: 0, y: 35 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="glass-romantic rounded-3xl p-6 sm:p-8 w-full border border-pink-500/30 text-left space-y-3"
        >
          <div className="flex items-center space-x-2 text-pink-400 font-bold text-sm">
            <Shield className="w-5 h-5" />
            <span>Complete Data Privacy & Ephemeral Chat Guarantee</span>
          </div>
          <p className="text-xs sm:text-sm text-pink-100/90 leading-relaxed">
            Cupidx strictly distinguishes between ephemeral chat conversations and persistent account profiles. Real-time random chat messages are <strong>100% ephemeral</strong>—never archived or retained after a conversation ends or when NEXT is clicked. Account profile credentials (@username, avatar, and 18+ verification) are stored securely and can be permanently deleted at any time from your Settings.
          </p>
          <div className="pt-1">
            <Link
              href="/privacy"
              className="text-xs font-bold text-pink-400 hover:text-pink-300 underline underline-offset-4 inline-flex items-center gap-1 transition-colors"
            >
              <span>Read our full Privacy Policy & Data Retention terms</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 border-t border-pink-500/15 flex flex-col sm:flex-row justify-between items-center gap-3 z-10 bg-slate-950/60 backdrop-blur-md">
        <span className="text-xs text-pink-300/60 font-medium">
          © {new Date().getFullYear()} Cupidx. Connect. Chat. Move on.
        </span>
        <div className="flex flex-wrap items-center gap-4 text-xs text-pink-200/80 font-semibold">
          <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
          <Link href="/refund" className="hover:text-white transition-colors">Refund Policy</Link>
          <Link href="/community-guidelines" className="hover:text-white transition-colors">Guidelines</Link>
          <Link href="/contact" className="hover:text-white transition-colors">Contact</Link>
        </div>
      </footer>
    </div>
  );
}
