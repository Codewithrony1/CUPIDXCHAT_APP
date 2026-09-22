'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { detectUserCountry } from '@/lib/countryFlag';
import { Heart, Home, Sparkles, LogOut, MessageSquare, User, Settings, MapPin, Crown, Users } from 'lucide-react';
import UserAvatar from '@/components/UserAvatar';

export default function Sidebar({
  onOpenVIPModal,
  onClose,
}: {
  onOpenVIPModal?: () => void;
  onClose?: () => void;
}) {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  const [locationInfo, setLocationInfo] = useState({
    countryCode: 'IN',
    countryName: 'India',
    flag: '🇮🇳',
  });

  useEffect(() => {
    detectUserCountry().then((info) => {
      if (info) {
        setLocationInfo(info);
      }
    });
  }, []);

  if (!user) return null;

  const isVIP = user?.membershipTier === 'VIP' || (user?.subscription?.isActive === true && user?.subscription?.plan === 'VIP');

  return (
    <aside className="hidden md:flex w-64 glass border-r border-white/5 flex-col justify-between h-screen sticky top-0 p-6 z-20 bg-slate-950/80 shrink-0">
      <div className="space-y-8">
        {/* Brand Logo Header */}
        <div className="flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center shadow-md">
              <Heart className="w-5 h-5 text-white fill-white/20" />
            </div>
            <span className="text-xl font-bold tracking-wider text-white">
              Cupid<span className="text-pink-500">X</span>
            </span>
          </Link>
        </div>

        {/* Profile Card Summary */}
        <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-3 relative overflow-hidden">
          {isVIP && (
            <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-500/10 rounded-full blur-xl -mr-4 -mt-4" />
          )}
          <div className="flex items-center space-x-3">
            <UserAvatar user={user} size="md" />
            <div className="overflow-hidden">
              <h4 className="text-sm font-semibold text-white truncate flex items-center gap-1">
                <span className="truncate">{user.displayName || user.fullName}</span>
                <span className="text-sm shrink-0" title={locationInfo.countryName}>
                  {locationInfo.flag}
                </span>
                {isVIP && <Sparkles className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500 shrink-0" />}
              </h4>
              <p className="text-xs text-slate-400 truncate">@{user.username}</p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            {isVIP ? (
              <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-[10px] font-extrabold uppercase tracking-wide">
                <Crown className="w-3 h-3 fill-current" />
                <span>VIP MEMBER</span>
              </div>
            ) : (
              <Link
                href="/vip"
                className="py-1.5 px-3 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 text-slate-950 font-extrabold text-[11px] shadow-md transition-all active:scale-95 cursor-pointer block text-center"
              >
                👑 Get VIP
              </Link>
            )}

            <div className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-pink-300 text-[10px] font-semibold">
              <MapPin className="w-2.5 h-2.5 text-pink-400 shrink-0" />
              <span>{locationInfo.countryName}</span>
              <span>{locationInfo.flag}</span>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="space-y-1.5">
          <Link
            href="/dashboard"
            className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
              pathname === '/dashboard'
                ? 'bg-purple-600/20 text-purple-300 border border-purple-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Home className="w-4 h-4" />
            <span>Dashboard</span>
          </Link>

          <Link
            href="/chat/random"
            className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
              pathname.startsWith('/chat')
                ? 'bg-purple-600/20 text-purple-300 border border-purple-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Random Chat</span>
          </Link>

          <Link
            href="/friends"
            className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
              pathname.startsWith('/friends')
                ? 'bg-purple-600/20 text-purple-300 border border-purple-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Friends</span>
          </Link>

          <Link
            href="/vip"
            className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
              pathname === '/vip'
                ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/20'
                : 'text-yellow-400 hover:text-yellow-300 hover:bg-white/5'
            }`}
          >
            <Crown className="w-4 h-4 text-yellow-400" />
            <span>VIP Membership</span>
          </Link>

          <Link
            href="/profile"
            className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
              pathname === '/profile'
                ? 'bg-purple-600/20 text-purple-300 border border-purple-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Profile</span>
          </Link>

          <Link
            href="/settings"
            className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
              pathname === '/settings'
                ? 'bg-purple-600/20 text-purple-300 border border-purple-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </Link>
        </nav>
      </div>

      {/* Logout Button */}
      <button
        onClick={logout}
        className="flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium text-rose-300 hover:text-white hover:bg-rose-500/20 border border-rose-500/20 transition-all cursor-pointer w-full text-left"
      >
        <LogOut className="w-4 h-4" />
        <span>Log Out</span>
      </button>
    </aside>
  );
}
