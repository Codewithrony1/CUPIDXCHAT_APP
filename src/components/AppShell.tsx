'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  Heart,
  MessageSquare,
  User,
  Home,
  Settings,
  Crown,
  Sparkles,
  X,
  Menu,
  LogOut,
  Flame,
  Users,
} from 'lucide-react';
import FloatingHearts from '@/components/FloatingHearts';
import Sidebar from '@/components/Sidebar';
import UserAvatar from '@/components/UserAvatar';

interface AppShellProps {
  children: React.ReactNode;
  showNav?: boolean;
  showHeader?: boolean;
  fullHeightChat?: boolean;
  containerStyle?: React.CSSProperties;
}

export default function AppShell({
  children,
  showNav = true,
  showHeader = true,
  fullHeightChat = false,
  containerStyle,
}: AppShellProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isVIP = user?.membershipTier === 'VIP' || (user?.subscription?.isActive === true && user?.subscription?.plan === 'VIP');

  // 1. Body Scroll Lock & Cleanup after closing
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [drawerOpen]);

  // 2. Automatic Closure on Route Change
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // 3. Escape Key Listener for Desktop/Tablet
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && drawerOpen) {
        setDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [drawerOpen]);

  const isTabActive = (path: string) => {
    if (path === '/dashboard' && pathname === '/dashboard') return true;
    if (path === '/chat' && pathname.startsWith('/chat')) return true;
    if (path === '/friends' && pathname.startsWith('/friends')) return true;
    if (path === '/vip' && pathname === '/vip') return true;
    if (path === '/profile' && pathname === '/profile') return true;
    if (path === '/settings' && pathname === '/settings') return true;
    return false;
  };

  return (
    <div
      style={containerStyle}
      className={`${
        fullHeightChat
          ? 'h-[100dvh] max-h-[100dvh] overflow-hidden'
          : 'min-h-[100dvh] overflow-x-hidden'
      } bg-[#0d0014] text-white flex flex-col md:flex-row justify-between relative selection:bg-pink-500 selection:text-white`}
    >
      {/* Background Effects */}
      <FloatingHearts />

      {/* Desktop PC Sidebar Panel (Laptop/Desktop View) */}
      <Sidebar />

      {/* Mobile Dark Backdrop Overlay */}
      <div
        onClick={() => setDrawerOpen(false)}
        aria-hidden="true"
        className={`md:hidden fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[90] transition-opacity duration-300 ease-in-out ${
          drawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Mobile Sliding Navigation Drawer (Sidebar) */}
      <aside
        id="navigation-drawer"
        aria-label="Navigation Menu"
        aria-hidden={!drawerOpen}
        className={`md:hidden fixed top-0 left-0 bottom-0 z-[100] w-80 max-w-[85vw] bg-[#120019] text-white flex flex-col justify-between p-6 shadow-2xl border-r border-pink-500/30 transition-transform duration-300 ease-in-out pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))] overflow-y-auto ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="space-y-6">
          {/* Sidebar Header: CupidX Logo + Close Button */}
          <div className="flex items-center justify-between border-b border-pink-500/20 pb-4">
            <Link href="/dashboard" onClick={() => setDrawerOpen(false)} className="flex items-center space-x-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-pink-600 to-rose-500 flex items-center justify-center shadow-md shadow-pink-500/30">
                <Heart className="w-5 h-5 text-white fill-white animate-pulse" />
              </div>
              <span className="text-xl font-black tracking-wider text-white">
                Cupid<span className="text-pink-400">X</span>
              </span>
            </Link>

            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="p-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 hover:text-white border border-rose-500/40 transition-all cursor-pointer shrink-0 shadow-md active:scale-95 flex items-center justify-center"
              aria-label="Close Navigation Menu"
            >
              <X className="w-5 h-5 font-bold" />
            </button>
          </div>

          {/* User Card Profile Summary */}
          {user && (
            <div className="p-4 rounded-2xl bg-white/5 border border-pink-500/20 space-y-3 relative overflow-hidden">
              <div className="flex items-center space-x-3">
                <UserAvatar user={user} size="md" />
                <div className="overflow-hidden">
                  <h4 className="text-sm font-bold text-white truncate flex items-center gap-1">
                    {user.displayName || user.fullName}
                    {isVIP && <Sparkles className="w-3.5 h-3.5 text-yellow-400 fill-current shrink-0" />}
                  </h4>
                  <p className="text-xs text-pink-200/70 truncate">@{user.username}</p>
                </div>
              </div>

              {isVIP ? (
                <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-yellow-500/15 border border-yellow-500/30 text-yellow-400 text-[10px] font-extrabold uppercase tracking-wide">
                  <Crown className="w-3 h-3 fill-current" />
                  <span>VIP MEMBER ACTIVE</span>
                </div>
              ) : (
                <Link
                  href="/vip"
                  onClick={() => setDrawerOpen(false)}
                  className="w-full py-2 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-600 text-slate-950 font-bold text-xs shadow-md transition-all active:scale-95 block text-center"
                >
                  👑 Upgrade to CupidX VIP
                </Link>
              )}
            </div>
          )}

          {/* Drawer Nav Links */}
          <nav className="space-y-1.5">
            <Link
              href="/dashboard"
              onClick={() => setDrawerOpen(false)}
              className={`flex items-center space-x-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all ${
                pathname === '/dashboard'
                  ? 'bg-pink-500/20 text-pink-300 border border-pink-500/30'
                  : 'text-pink-100/80 hover:text-white hover:bg-white/5'
              }`}
            >
              <Home className="w-4 h-4" />
              <span>Dashboard</span>
            </Link>

            <Link
              href="/chat/random"
              onClick={() => setDrawerOpen(false)}
              className={`flex items-center space-x-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all ${
                pathname.startsWith('/chat')
                  ? 'bg-pink-500/20 text-pink-300 border border-pink-500/30'
                  : 'text-pink-100/80 hover:text-white hover:bg-white/5'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>Random Chat</span>
            </Link>

            <Link
              href="/friends"
              onClick={() => setDrawerOpen(false)}
              className={`flex items-center space-x-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all ${
                pathname.startsWith('/friends')
                  ? 'bg-pink-500/20 text-pink-300 border border-pink-500/30'
                  : 'text-pink-100/80 hover:text-white hover:bg-white/5'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>VIP Friends</span>
            </Link>

            <Link
              href="/vip"
              onClick={() => setDrawerOpen(false)}
              className={`flex items-center space-x-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all ${
                pathname === '/vip'
                  ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                  : 'text-yellow-400 hover:text-yellow-300 hover:bg-white/5'
              }`}
            >
              <Crown className="w-4 h-4 text-yellow-400" />
              <span>VIP Membership</span>
            </Link>

            <Link
              href="/profile"
              onClick={() => setDrawerOpen(false)}
              className={`flex items-center space-x-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all ${
                pathname === '/profile'
                  ? 'bg-pink-500/20 text-pink-300 border border-pink-500/30'
                  : 'text-pink-100/80 hover:text-white hover:bg-white/5'
              }`}
            >
              <User className="w-4 h-4" />
              <span>Profile</span>
            </Link>

            <Link
              href="/settings"
              onClick={() => setDrawerOpen(false)}
              className={`flex items-center space-x-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all ${
                pathname === '/settings'
                  ? 'bg-pink-500/20 text-pink-300 border border-pink-500/30'
                  : 'text-pink-100/80 hover:text-white hover:bg-white/5'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Settings & Privacy</span>
            </Link>

          </nav>
        </div>

        {/* Logout Button inside Drawer */}
        <button
          onClick={() => {
            setDrawerOpen(false);
            logout();
          }}
          className="flex items-center space-x-3 px-4 py-3.5 rounded-2xl text-xs font-bold text-rose-300 hover:text-white hover:bg-rose-500/20 border border-rose-500/30 transition-all cursor-pointer w-full text-left"
        >
          <LogOut className="w-4 h-4" />
          <span>Log Out</span>
        </button>
      </aside>

      {/* Desktop Frame Wrapper */}
      <div
        className={`w-full max-w-5xl mx-auto flex flex-col flex-grow relative z-10 ${
          fullHeightChat
            ? 'h-full max-h-full overflow-hidden py-0'
            : 'min-h-[100dvh] sm:py-4'
        }`}
      >
        {/* Compact App Header */}
        {showHeader && (
          <header className="w-full px-4 py-3 flex items-center justify-between border-b border-pink-500/15 bg-slate-950/40 backdrop-blur-md sticky top-0 z-30 sm:rounded-t-3xl shrink-0">
            <div className="flex items-center space-x-2.5">
              {/* Hamburger Menu Toggle Button (Mobile Only) */}
              <button
                onClick={() => setDrawerOpen(true)}
                aria-expanded={drawerOpen}
                aria-controls="navigation-drawer"
                aria-label="Toggle Navigation Menu"
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-pink-300 hover:text-white border border-pink-500/20 transition-all cursor-pointer flex items-center justify-center shrink-0 active:scale-95 sm:hidden"
              >
                <Menu className="w-4 h-4 text-pink-300" />
              </button>

              <Link href="/dashboard" className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-pink-600 to-rose-500 flex items-center justify-center shadow-md shadow-pink-500/30">
                  <Heart className="w-4.5 h-4.5 text-white fill-white animate-pulse" />
                </div>
                <span className="text-lg font-black tracking-wider text-white">
                  Cupid<span className="text-pink-400">X</span>
                </span>
              </Link>
            </div>

            <div className="flex items-center space-x-3">
              <Link
                href="/vip"
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 text-slate-950 font-bold text-[11px] flex items-center gap-1 shadow-sm transition-all"
              >
                <Crown className="w-3 h-3 fill-current" />
                <span>VIP</span>
              </Link>

              <Link href="/profile" className="flex items-center space-x-1.5 group">
                <img
                  src={user?.profile?.avatarUrl || `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${user?.username || 'me'}`}
                  alt={user?.displayName || user?.username ? `Profile picture for ${user?.displayName || user?.username}` : 'My profile picture'}
                  className="w-8 h-8 rounded-full border border-pink-400/50 object-cover group-hover:scale-105 transition-transform"
                />
              </Link>
            </div>
          </header>
        )}

        {/* Main Content Area */}
        <main
          className={`flex-grow flex flex-col relative z-10 min-h-0 ${
            fullHeightChat ? 'h-full overflow-hidden' : showNav ? 'pb-20 sm:pb-6' : ''
          }`}
        >
          {children}
        </main>
      </div>

      {/* Mobile Fixed Bottom Navigation Bar */}
      {showNav && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#120019]/90 backdrop-blur-xl border-t border-pink-500/20 px-4 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] sm:hidden">
          <div className="max-w-md mx-auto flex items-center justify-between">
            {/* Home Tab */}
            <Link
              href="/dashboard"
              className={`flex flex-col items-center space-y-1 transition-all ${
                isTabActive('/dashboard') ? 'text-pink-400 scale-105 font-bold' : 'text-pink-200/60 hover:text-white'
              }`}
            >
              <Home className="w-5 h-5" />
              <span className="text-[10px]">Home</span>
            </Link>

            {/* Chat Tab */}
            <Link
              href="/chat/random"
              className={`flex flex-col items-center space-y-1 transition-all ${
                isTabActive('/chat') ? 'text-pink-400 scale-105 font-bold' : 'text-pink-200/60 hover:text-white'
              }`}
            >
              <div className="relative">
                <MessageSquare className="w-5 h-5" />
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-pink-500 animate-ping" />
              </div>
              <span className="text-[10px]">Chat</span>
            </Link>

            {/* Friends Tab */}
            <Link
              href="/friends"
              className={`flex flex-col items-center space-y-1 transition-all ${
                isTabActive('/friends') ? 'text-pink-400 scale-105 font-bold' : 'text-pink-200/60 hover:text-white'
              }`}
            >
              <Users className="w-5 h-5" />
              <span className="text-[10px]">Friends</span>
            </Link>

            {/* VIP Tab */}
            <Link
              href="/vip"
              className={`flex flex-col items-center space-y-1 transition-all ${
                isTabActive('/vip') ? 'text-yellow-400 scale-105 font-bold' : 'text-yellow-500/70 hover:text-yellow-300'
              }`}
            >
              <Crown className="w-5 h-5" />
              <span className="text-[10px]">VIP</span>
            </Link>

            {/* Profile Tab */}
            <Link
              href="/profile"
              className={`flex flex-col items-center space-y-1 transition-all ${
                isTabActive('/profile') ? 'text-pink-400 scale-105 font-bold' : 'text-pink-200/60 hover:text-white'
              }`}
            >
              <User className="w-5 h-5" />
              <span className="text-[10px]">Profile</span>
            </Link>

            {/* Settings Tab */}
            <Link
              href="/settings"
              className={`flex flex-col items-center space-y-1 transition-all ${
                isTabActive('/settings') ? 'text-pink-400 scale-105 font-bold' : 'text-pink-200/60 hover:text-white'
              }`}
            >
              <Settings className="w-5 h-5" />
              <span className="text-[10px]">Settings</span>
            </Link>
          </div>
        </nav>
      )}
    </div>
  );
}
