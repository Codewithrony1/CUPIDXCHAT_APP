'use client';

import React, { useState } from 'react';
import BottomSheet from '@/components/ui/BottomSheet';
import { Crown, UserPlus, Check } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { DEFAULT_BIO } from '@/lib/vipCommon';

interface PartnerProfile {
  id: string;
  username?: string;
  vipUsername?: string | null;
  fullName?: string;
  displayName?: string;
  avatarType?: string;
  avatarEmoji?: string;
  avatarUrl?: string | null;
  gender: string;
  mood?: string;
  personalityPreferences?: string;
  bio?: string;
  isVIP: boolean;
  countryCode?: string;
  countryName?: string;
  countryFlag?: string;
}

interface ProfilePreviewSheetProps {
  isOpen: boolean;
  onClose: () => void;
  partner: PartnerProfile | null;
}

export default function ProfilePreviewSheet({
  isOpen,
  onClose,
  partner,
}: ProfilePreviewSheetProps) {
  const { user } = useAuth();
  const now = new Date();
  const isExpired = user?.vip_expires_at && new Date(user.vip_expires_at).getTime() <= now.getTime();
  const isViewerVip = !isExpired && Boolean(
    user?.is_vip ||
    user?.membershipTier === 'VIP' ||
    (user?.subscription?.isActive === true && user?.subscription?.plan === 'VIP')
  );

  const [sendingReq, setSendingReq] = useState(false);
  const [reqSent, setReqSent] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  if (!partner) return null;

  const displayName = partner.displayName || partner.fullName || 'Stranger';
  const isImageAvatar = partner.isVIP && partner.avatarType === 'IMAGE' && partner.avatarUrl;
  const avatarEmoji = partner.avatarEmoji || '😊';

  const personalityTags = partner.personalityPreferences
    ? partner.personalityPreferences.split(',').filter(Boolean)
    : [];

  const handleSendFriendRequest = async () => {
    if (sendingReq || reqSent) return;
    setSendingReq(true);
    setErrorNotice(null);
    setSuccessNotice(null);

    try {
      const res = await fetch('/api/social/friends/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: partner.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setReqSent(true);
        setSuccessNotice('Friend request sent successfully! ✨');
      } else {
        const primaryError = data.error || 'Failed to send friend request.';
        const adminMsg = data.contactAdmin ? ` ${data.contactAdmin}` : '';
        setErrorNotice(`${primaryError}${adminMsg}`);
      }
    } catch {
      setErrorNotice('Network error sending friend request.');
    } finally {
      setSendingReq(false);
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={`${displayName}'s Profile`}>
      <div className="space-y-5 py-2 text-white">
        
        {/* Header Avatar */}
        <div className="text-center space-y-3">
          <div className="relative w-24 h-24 mx-auto">
            {isImageAvatar ? (
              <img
                src={partner.avatarUrl!}
                alt={`Profile picture for ${displayName}`}
                className="w-24 h-24 rounded-3xl object-cover border-2 border-pink-500/40 shadow-xl shadow-pink-500/20"
              />
            ) : (
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-pink-600/30 to-purple-600/30 border-2 border-pink-500/40 shadow-xl shadow-pink-500/20 flex items-center justify-center text-5xl select-none">
                {avatarEmoji}
              </div>
            )}

            {partner.isVIP && (
              <div className="absolute -top-2 -right-2 p-1.5 rounded-full bg-gradient-to-tr from-yellow-500 to-amber-400 text-slate-950 shadow-md">
                <Crown className="w-4 h-4 fill-current" />
              </div>
            )}
          </div>

          <div>
            <h3 className="text-xl font-black tracking-tight text-white">{displayName}</h3>
            {isViewerVip && (partner.vipUsername || partner.username) && (
              <p className="text-xs font-bold text-pink-400 mt-0.5">
                @{partner.vipUsername || partner.username}
              </p>
            )}
            {partner.isVIP && (
              <div className="flex items-center justify-center space-x-1.5 mt-1">
                <span className="text-[10px] font-black text-yellow-300 bg-yellow-500/20 px-2 py-0.5 rounded-full border border-yellow-500/30 flex items-center gap-1">
                  <Crown className="w-3 h-3 fill-current" /> 💎 VIP
                </span>
              </div>
            )}
            {partner.countryFlag && (
              <div className="flex items-center justify-center space-x-1.5 mt-1.5 text-xs text-slate-300">
                <span className="text-sm">{partner.countryFlag}</span>
                <span className="font-semibold">{partner.countryName || 'Global'}</span>
              </div>
            )}
          </div>
        </div>

        {/* Current Mood Pill */}
        {partner.mood && (
          <div className="p-3 rounded-2xl bg-white/5 border border-pink-500/20 text-center space-y-1">
            <span className="text-[10px] font-bold text-pink-300 uppercase tracking-wider block">Current Mood</span>
            <p className="text-sm font-extrabold text-white">{partner.mood}</p>
          </div>
        )}

        {/* Bio */}
        <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 text-xs text-pink-100/90 leading-relaxed text-center italic">
          &ldquo;{partner.bio || DEFAULT_BIO}&rdquo;
        </div>

        {/* Personality Tags */}
        {personalityTags.length > 0 && (
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-pink-300 uppercase tracking-wider block text-center">
              Personality Tags
            </span>
            <div className="flex flex-wrap justify-center gap-1.5">
              {personalityTags.map((tag, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1.5 rounded-full bg-gradient-to-r from-pink-600/30 to-purple-600/30 text-pink-200 text-xs font-semibold border border-pink-500/20"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Notices */}
        {errorNotice && (
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-medium text-center space-y-1">
            <p>{errorNotice}</p>
          </div>
        )}

        {successNotice && (
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-medium text-center flex items-center justify-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            <p>{successNotice}</p>
          </div>
        )}

        {/* VIP Friend Request Action */}
        {isViewerVip && (
          <button
            type="button"
            onClick={handleSendFriendRequest}
            disabled={sendingReq || reqSent}
            className="w-full py-3 rounded-2xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white text-xs shadow-md shadow-pink-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 active:scale-98"
          >
            <UserPlus className="w-4 h-4" />
            <span>{reqSent ? 'Friend Request Sent' : sendingReq ? 'Sending...' : 'Send Friend Request'}</span>
          </button>
        )}

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 rounded-2xl font-bold bg-white/10 hover:bg-white/20 text-white text-xs transition-colors cursor-pointer"
        >
          Close Preview
        </button>

      </div>
    </BottomSheet>
  );
}
