'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import AppShell from '@/components/AppShell';
import CallModal from '@/components/social/CallModal';
import { DEFAULT_BIO } from '@/lib/vipCommon';
import {
  Users,
  MessageSquare,
  UserPlus,
  Search,
  Crown,
  Sparkles,
  Phone,
  Video,
  Check,
  X,
  Clock,
  Shield,
  Trash2,
  AlertCircle,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';

interface FriendItem {
  friendshipId: string;
  friend: {
    id: string;
    username: string;
    hasVipUsername: boolean;
    displayName: string;
    avatarUrl: string | null;
    avatarEmoji: string;
    isOnline: boolean;
    lastSeen: string | null;
    bio: string;
  };
  conversationId: string | null;
  createdAt: string;
}

interface ConversationItem {
  id: string;
  partner: {
    id: string;
    username: string;
    hasVipUsername: boolean;
    displayName: string;
    avatarUrl: string | null;
    avatarEmoji: string;
    isOnline: boolean;
  };
  lastMessage: {
    id: string;
    type: string;
    content: string;
    imageUrl: string | null;
    senderId: string;
    isMine: boolean;
    createdAt: string;
  } | null;
  lastMessageAt: string;
}

interface RequestItem {
  id: string;
  createdAt: string;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    avatarEmoji: string;
    isOnline: boolean;
  };
}

interface SearchedUserItem {
  id: string;
  username: string;
  hasVipUsername: boolean;
  displayName: string;
  avatarUrl: string | null;
  avatarEmoji: string;
  isOnline: boolean;
  bio: string;
  relationshipStatus: 'FRIENDS' | 'REQUEST_SENT' | 'REQUEST_RECEIVED' | 'NONE';
  requestId: string | null;
}

export default function FriendsHubPage() {
  const router = useRouter();
  const { user, loading, refreshUser } = useAuth();

  const isVIP = Boolean(
    user?.membershipTier === 'VIP' ||
    user?.is_vip ||
    user?.isVIP ||
    (user?.subscription?.isActive === true && user?.subscription?.plan === 'VIP')
  );

  // Navigation tab
  const [activeTab, setActiveTab] = useState<'friends' | 'chats' | 'requests' | 'discover'>('friends');

  // Username claim states
  const [claimInput, setClaimInput] = useState('');
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [claimStatus, setClaimStatus] = useState<{ available?: boolean; reason?: string; message?: string } | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimedUsername, setClaimedUsername] = useState<string | null>(null);
  const checkDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Data states
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<RequestItem[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<RequestItem[]>([]);
  const [pendingCount, setPendingCount] = useState(0);

  // Discover search states
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchedUserItem[]>([]);
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Action status
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const effectiveUsername = claimedUsername || user?.vipUsername || user?.username || 'member';
  const effectiveVipUsername = claimedUsername || user?.vipUsername || null;

  const getAuthHeaders = useCallback(() => {
    const headers: Record<string, string> = {};
    if (user?.clerkUserId || user?.id) {
      headers['x-clerk-user-id'] = user.clerkUserId || user.id;
    }
    return headers;
  }, [user]);

  // ─── Fetch All Social Data ────────────────────────────────────────────────
  const fetchFriends = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch('/api/social/friends', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setFriends(data.friends || []);
      }
    } catch (e) {}
  }, [user, getAuthHeaders]);

  const fetchConversations = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch('/api/social/conversations', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
      }
    } catch (e) {}
  }, [user, getAuthHeaders]);

  const fetchRequests = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch('/api/social/friends/requests', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setIncomingRequests(data.incoming || []);
        setOutgoingRequests(data.outgoing || []);
        setPendingCount(data.pendingCount || 0);
      }
    } catch (e) {}
  }, [user, getAuthHeaders]);

  useEffect(() => {
    if (user) {
      fetchFriends();
      fetchConversations();
      fetchRequests();

      // Poll requests periodically
      const interval = setInterval(() => {
        fetchRequests();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [user, fetchFriends, fetchConversations, fetchRequests]);

  // ─── Username Availability Check ──────────────────────────────────────────
  const handleClaimInputChange = (val: string) => {
    const cleaned = val.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setClaimInput(cleaned);
    setClaimStatus(null);

    if (checkDebounceRef.current) clearTimeout(checkDebounceRef.current);
    if (!cleaned || cleaned.length < 3) return;

    setCheckingUsername(true);
    checkDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/social/username/check?username=${encodeURIComponent(cleaned)}`);
        const data = await res.json();
        setClaimStatus(data);
      } catch (e) {
        setClaimStatus({ available: false, reason: 'Network error checking handle.' });
      } finally {
        setCheckingUsername(false);
      }
    }, 450);
  };

  const handleClaimSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimInput || claimInput.length < 3 || claiming) return;

    setClaiming(true);
    try {
      const res = await fetch('/api/social/username/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: claimInput }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setClaimedUsername(data.username);
        try {
          await refreshUser?.();
        } catch (e) {}
        alert(data.message);
      } else {
        alert(data.error || 'Failed to claim username.');
      }
    } catch (e) {
      alert('Error claiming username.');
    } finally {
      setClaiming(false);
    }
  };

  // ─── Discover Search ──────────────────────────────────────────────────────
  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!val.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/social/users/search?q=${encodeURIComponent(val)}`, {
          headers: getAuthHeaders(),
        });
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.users || []);
        }
      } catch (e) {} finally {
        setSearching(false);
      }
    }, 400);
  };

  // ─── Friend Request Actions ───────────────────────────────────────────────
  const handleSendRequest = async (targetUserId: string) => {
    setActionLoading(targetUserId);
    try {
      const res = await fetch('/api/social/friends/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ targetUserId }),
      });
      const data = await res.json();
      if (res.ok) {
        // Update search results locally
        setSearchResults((prev) =>
          prev.map((u) => (u.id === targetUserId ? { ...u, relationshipStatus: 'REQUEST_SENT' } : u))
        );
        fetchRequests();
      } else {
        alert(data.error || 'Failed to send request.');
      }
    } catch (e) {
      alert('Network error sending request.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    setActionLoading(requestId);
    try {
      const res = await fetch(`/api/social/friends/requests/${requestId}/accept`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (res.ok) {
        fetchRequests();
        fetchFriends();
        fetchConversations();
      } else {
        alert(data.error || 'Failed to accept request.');
      }
    } catch (e) {
      alert('Error accepting request.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    setActionLoading(requestId);
    try {
      const res = await fetch(`/api/social/friends/requests/${requestId}/reject`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        fetchRequests();
      }
    } catch (e) {} finally {
      setActionLoading(null);
    }
  };

  const handleCancelRequest = async (requestId: string) => {
    setActionLoading(requestId);
    try {
      const res = await fetch(`/api/social/friends/requests/${requestId}/cancel`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        fetchRequests();
      }
    } catch (e) {} finally {
      setActionLoading(null);
    }
  };

  const handleRemoveFriend = async (friendId: string, friendName: string) => {
    if (!confirm(`Are you sure you want to remove @${friendName} from your friends?`)) return;
    try {
      const res = await fetch('/api/social/friends/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ friendId }),
      });
      if (res.ok) {
        fetchFriends();
        fetchConversations();
      }
    } catch (e) {}
  };

  // ─── Start Call Helper ────────────────────────────────────────────────────
  const handleStartCall = async (conversationId: string, callType: 'VOICE' | 'VIDEO') => {
    try {
      // 1. Get user media to verify permission & create offer
      const isVideo = callType === 'VIDEO';
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: isVideo ? { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' } : false,
      });

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Clean up temp stream immediately — CallModal will re-acquire full stream
      stream.getTracks().forEach((t) => t.stop());
      pc.close();

      const res = await fetch('/api/social/call/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          conversationId,
          callType,
          offerSdp: offer.sdp,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to initiate call.');
      }
    } catch (err: any) {
      console.error('Call initiation error:', err);
      alert('Camera/microphone access required to place calls. Please check browser permissions.');
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────────────────────

  return (
    <AppShell>
      <div className="w-full max-w-4xl mx-auto px-4 py-6 space-y-6 pb-24">
        {/* Global WebRTC Call Modal Overlay */}
        <CallModal onCallEnded={() => { fetchConversations(); }} />

        {/* VIP Upsell Banner for Free Users (Non-blocking) */}
        {!isVIP && !loading && (
          <div className="rounded-2xl bg-gradient-to-r from-yellow-500/10 via-pink-500/10 to-purple-500/10 border border-yellow-500/30 p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-yellow-500/20 border border-yellow-500/40 flex items-center justify-center shrink-0">
                <Crown className="w-5 h-5 text-yellow-400 fill-current" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-black text-white">Upgrade to CupidX VIP</span>
                  <span className="px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 font-extrabold text-[9px] uppercase">Gold Perks</span>
                </div>
                <p className="text-[11px] text-slate-300">Claim your custom @username, gold VIP badge, and unlock VIP privileges.</p>
              </div>
            </div>
            <Link
              href="/vip"
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-md shrink-0 active:scale-95 transition-all"
            >
              Get VIP
            </Link>
          </div>
        )}

        {/* 2. VIP USER: USERNAME SETUP FLOW (IF NOT CLAIMED YET) */}
        {isVIP && !effectiveVipUsername && (
          <div className="rounded-3xl bg-gradient-to-b from-[#1f0036] to-[#0f0019] border border-pink-500/40 p-6 sm:p-8 space-y-6 shadow-2xl">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-2xl bg-pink-500/20 border border-pink-500/40 flex items-center justify-center text-pink-400">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <span className="px-2.5 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 font-extrabold text-[10px] uppercase">
                  Step 1 of VIP Setup
                </span>
                <h3 className="text-xl font-black text-white">Claim Your CupidX Handle</h3>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed max-w-xl">
              As an active VIP member, choose your permanent, unique username. Friends can use this handle to search for you and connect on CupidX.
            </p>

            <form onSubmit={handleClaimSubmit} className="space-y-4 max-w-md">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-pink-200">Desired @username</label>
                <div className="relative">
                  <span className="absolute left-4 top-3.5 text-slate-400 font-bold">@</span>
                  <input
                    type="text"
                    value={claimInput}
                    onChange={(e) => handleClaimInputChange(e.target.value)}
                    placeholder="alex, rohit, priya..."
                    maxLength={20}
                    className="w-full pl-8 pr-10 py-3 rounded-2xl bg-black/40 border border-pink-500/30 text-white font-mono text-sm placeholder:text-slate-600 focus:outline-none focus:border-pink-400 focus:ring-1 focus:ring-pink-400 transition-all"
                  />
                  {checkingUsername && (
                    <span className="absolute right-3.5 top-3.5 text-xs text-slate-400 animate-spin">⏳</span>
                  )}
                </div>
              </div>

              {/* Status feedback */}
              {claimStatus && (
                <div
                  className={`text-xs font-bold p-3 rounded-xl border flex items-center space-x-2 ${
                    claimStatus.available
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  }`}
                >
                  {claimStatus.available ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                  <span>{claimStatus.available ? 'Username is available!' : claimStatus.reason}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={!claimStatus?.available || claiming}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-pink-600 to-purple-600 disabled:opacity-40 hover:from-pink-500 hover:to-purple-500 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-pink-500/20 active:scale-95 transition-all cursor-pointer"
              >
                {claiming ? 'Claiming...' : 'Claim VIP Username'}
              </button>
            </form>
          </div>
        )}

        {/* Not Logged In Fallback */}
        {!user && !loading && (
          <div className="p-8 text-center rounded-3xl bg-white/5 border border-white/10 space-y-4">
            <h3 className="text-lg font-bold text-white">Please log in</h3>
            <p className="text-xs text-slate-400">Sign in to search members, add friends, and chat privately.</p>
            <Link
              href="/login"
              className="inline-block px-6 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold shadow-md shadow-pink-500/20"
            >
              Log In
            </Link>
          </div>
        )}

        {/* 3. SOCIAL MAIN DASHBOARD (FOR ALL AUTHENTICATED USERS) */}
        {user && !loading && (
          <div className="space-y-6">
            {/* Header Identity Card */}
            <div className="rounded-3xl bg-white/5 border border-white/10 p-5 flex flex-col sm:flex-row items-center justify-between gap-4 backdrop-blur-md">
              <div className="flex items-center space-x-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-pink-600 to-purple-600 p-0.5 shadow-md shadow-pink-500/20">
                  <div className="w-full h-full rounded-2xl bg-slate-950 overflow-hidden flex items-center justify-center">
                    {user?.profile?.avatarUrl ? (
                      <img
                        src={user.profile.avatarUrl}
                        alt={`Profile picture for ${user.displayName || user.username || 'me'}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-2xl">{user?.profile?.avatarEmoji || '😊'}</span>
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-lg font-black text-white">{user?.displayName || user?.fullName}</h3>
                    {isVIP && (
                      <span className="px-2 py-0.5 rounded-full bg-yellow-500/15 border border-yellow-500/30 text-yellow-400 text-[10px] font-extrabold uppercase flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        <span>VIP</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-mono font-bold text-pink-400">@{effectiveUsername}</p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Link
                  href="/chat/random"
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-300 hover:text-white flex items-center gap-1.5 transition-all"
                >
                  <span>Random Chat</span>
                  <ExternalLink className="w-3 h-3 text-slate-400" />
                </Link>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center space-x-1 p-1.5 rounded-2xl bg-black/40 border border-white/10 overflow-x-auto">
              <button
                onClick={() => setActiveTab('friends')}
                className={`flex-1 min-w-[80px] py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'friends'
                    ? 'bg-pink-600 text-white shadow-md shadow-pink-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Friends</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/10">{friends.length}</span>
              </button>

              <button
                onClick={() => setActiveTab('chats')}
                className={`flex-1 min-w-[80px] py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'chats'
                    ? 'bg-pink-600 text-white shadow-md shadow-pink-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Chats</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/10">{conversations.length}</span>
              </button>

              <button
                onClick={() => setActiveTab('requests')}
                className={`flex-1 min-w-[80px] py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer relative ${
                  activeTab === 'requests'
                    ? 'bg-pink-600 text-white shadow-md shadow-pink-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Requests</span>
                {pendingCount > 0 && (
                  <span className="w-2 h-2 rounded-full bg-pink-400 animate-ping absolute top-2 right-4" />
                )}
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/10">{pendingCount}</span>
              </button>

              <button
                onClick={() => setActiveTab('discover')}
                className={`flex-1 min-w-[80px] py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'discover'
                    ? 'bg-pink-600 text-white shadow-md shadow-pink-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Search className="w-3.5 h-3.5" />
                <span>Discover</span>
              </button>
            </div>

            {/* TAB CONTENT 1: FRIENDS */}
            {activeTab === 'friends' && (
              <div className="space-y-3">
                {friends.length === 0 ? (
                  <div className="p-8 text-center rounded-3xl bg-white/5 border border-white/10 space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mx-auto text-slate-400">
                      <Users className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-white">No friends added yet</h4>
                      <p className="text-xs text-slate-400">
                        Use the Discover tab to search for other members and send friend requests.
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveTab('discover')}
                      className="px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs cursor-pointer shadow-md shadow-pink-500/20"
                    >
                      Find Members
                    </button>
                  </div>
                ) : (
                  friends.map((item) => (
                    <div
                      key={item.friendshipId}
                      className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between gap-4 hover:border-pink-500/30 transition-all"
                    >
                      <div className="flex items-center space-x-3 overflow-hidden">
                        <div className="relative w-11 h-11 rounded-2xl overflow-hidden bg-slate-900 shrink-0 border border-white/10 flex items-center justify-center">
                          {item.friend.avatarUrl ? (
                            <img
                              src={item.friend.avatarUrl}
                              alt={`Profile picture for ${item.friend.displayName || item.friend.username}`}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-xl">{item.friend.avatarEmoji}</span>
                          )}
                          {item.friend.isOnline && (
                            <span className="absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-slate-950" />
                          )}
                        </div>

                        <div className="overflow-hidden">
                          <h4 className="text-sm font-bold text-white truncate">{item.friend.displayName}</h4>
                          <p className="text-xs font-mono font-bold text-pink-400 truncate">@{item.friend.username}</p>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center space-x-2 shrink-0">
                        {item.conversationId && (
                          <>
                            <button
                              onClick={() => handleStartCall(item.conversationId!, 'VOICE')}
                              className="p-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 hover:text-white transition-all cursor-pointer"
                              title="Voice Call"
                            >
                              <Phone className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => handleStartCall(item.conversationId!, 'VIDEO')}
                              className="p-2.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/30 border border-purple-500/30 text-purple-300 hover:text-white transition-all cursor-pointer"
                              title="Video Call"
                            >
                              <Video className="w-4 h-4" />
                            </button>

                            <Link
                              href={`/friends/chat/${item.conversationId}`}
                              className="px-3.5 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-black text-xs flex items-center gap-1 shadow-md shadow-pink-500/20 active:scale-95 transition-all"
                            >
                              <span>Chat</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </Link>
                          </>
                        )}

                        <button
                          onClick={() => handleRemoveFriend(item.friend.id, item.friend.username)}
                          className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          title="Remove Friend"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* TAB CONTENT 2: CHATS */}
            {activeTab === 'chats' && (
              <div className="space-y-3">
                {conversations.length === 0 ? (
                  <div className="p-8 text-center rounded-3xl bg-white/5 border border-white/10 space-y-2">
                    <p className="text-sm font-bold text-white">No active chats yet</p>
                    <p className="text-xs text-slate-400">
                      Message any of your accepted friends from the Friends tab to start a conversation!
                    </p>
                  </div>
                ) : (
                  conversations.map((conv) => (
                    <Link
                      key={conv.id}
                      href={`/friends/chat/${conv.id}`}
                      className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-pink-500/30 flex items-center justify-between gap-4 transition-all block group"
                    >
                      <div className="flex items-center space-x-3 overflow-hidden">
                        <div className="w-11 h-11 rounded-2xl overflow-hidden bg-slate-900 shrink-0 border border-white/10 flex items-center justify-center">
                          {conv.partner.avatarUrl ? (
                            <img
                              src={conv.partner.avatarUrl}
                              alt={`Profile picture for ${conv.partner.displayName || conv.partner.username}`}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-xl">{conv.partner.avatarEmoji}</span>
                          )}
                        </div>

                        <div className="overflow-hidden">
                          <div className="flex items-center space-x-2">
                            <h4 className="text-sm font-bold text-white group-hover:text-pink-300 transition-colors truncate">
                              {conv.partner.displayName}
                            </h4>
                            <span className="text-[11px] font-mono text-slate-400">@{conv.partner.username}</span>
                          </div>

                          <p className="text-xs text-slate-400 truncate">
                            {conv.lastMessage?.type === 'IMAGE'
                              ? '📷 Photo attachment'
                              : conv.lastMessage?.content || 'No messages yet'}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[10px] font-mono text-slate-500">
                          {new Date(conv.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            )}

            {/* TAB CONTENT 3: REQUESTS */}
            {activeTab === 'requests' && (
              <div className="space-y-6">
                {/* Incoming */}
                <div className="space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-pink-300">
                    Incoming Requests ({incomingRequests.length})
                  </h4>

                  {incomingRequests.length === 0 ? (
                    <p className="text-xs text-slate-400 bg-white/5 p-4 rounded-2xl border border-white/5">
                      No incoming requests.
                    </p>
                  ) : (
                    incomingRequests.map((req) => (
                      <div
                        key={req.id}
                        className="p-4 rounded-2xl bg-white/5 border border-pink-500/20 flex items-center justify-between gap-4"
                      >
                        <div className="flex items-center space-x-3 overflow-hidden">
                          <div className="w-10 h-10 rounded-2xl overflow-hidden bg-slate-900 shrink-0 flex items-center justify-center">
                            {req.user.avatarUrl ? (
                              <img
                                src={req.user.avatarUrl}
                                alt={`Profile picture for ${req.user.displayName || req.user.username}`}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-lg">{req.user.avatarEmoji}</span>
                            )}
                          </div>
                          <div>
                            <h5 className="text-xs font-bold text-white">{req.user.displayName}</h5>
                            <p className="text-[11px] font-mono font-bold text-pink-400">@{req.user.username}</p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 shrink-0">
                          <button
                            onClick={() => handleAcceptRequest(req.id)}
                            disabled={actionLoading === req.id}
                            className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-xs flex items-center gap-1 cursor-pointer active:scale-95 transition-all shadow-md shadow-emerald-500/20"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Accept</span>
                          </button>

                          <button
                            onClick={() => handleRejectRequest(req.id)}
                            disabled={actionLoading === req.id}
                            className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer transition-all"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Outgoing */}
                <div className="space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
                    Outgoing Pending Requests ({outgoingRequests.length})
                  </h4>

                  {outgoingRequests.length === 0 ? (
                    <p className="text-xs text-slate-500 bg-white/5 p-4 rounded-2xl border border-white/5">
                      No outgoing requests.
                    </p>
                  ) : (
                    outgoingRequests.map((req) => (
                      <div
                        key={req.id}
                        className="p-4 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between gap-4"
                      >
                        <div className="flex items-center space-x-3 overflow-hidden">
                          <div className="w-10 h-10 rounded-2xl overflow-hidden bg-slate-900 shrink-0 flex items-center justify-center">
                            {req.user.avatarUrl ? (
                              <img
                                src={req.user.avatarUrl}
                                alt={`Profile picture for ${req.user.displayName || req.user.username}`}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-lg">{req.user.avatarEmoji}</span>
                            )}
                          </div>
                          <div>
                            <h5 className="text-xs font-bold text-white">{req.user.displayName}</h5>
                            <p className="text-[11px] font-mono font-bold text-pink-400">@{req.user.username}</p>
                          </div>
                        </div>

                        <button
                          onClick={() => handleCancelRequest(req.id)}
                          disabled={actionLoading === req.id}
                          className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-rose-500/10 hover:text-rose-300 text-slate-400 text-xs font-bold transition-all cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTENT 4: DISCOVER / SEARCH */}
            {activeTab === 'discover' && (
              !isVIP ? (
                <div className="p-8 text-center rounded-3xl bg-gradient-to-b from-white/5 to-pink-500/5 border border-pink-500/20 space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-yellow-500/20 via-pink-500/20 to-purple-500/20 border border-pink-500/30 flex items-center justify-center mx-auto text-yellow-400 shadow-lg">
                    <Crown className="w-7 h-7" />
                  </div>
                  <div className="space-y-1.5 max-w-sm mx-auto">
                    <h4 className="text-base font-black text-white">VIP Discovery</h4>
                    <p className="text-xs text-pink-200/70 leading-relaxed">
                      Searching members and sending friend requests is an exclusive VIP feature. Upgrade to connect directly with anyone.
                    </p>
                  </div>
                  <Link
                    href="/vip"
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-gradient-to-r from-pink-600 via-rose-500 to-amber-500 text-white font-black text-xs shadow-lg shadow-pink-500/20 hover:brightness-110 active:scale-95 transition-all"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Get CupidX VIP</span>
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-500 absolute left-4 top-3.5" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      placeholder="Search by @username or name..."
                      className="w-full pl-11 pr-4 py-3 rounded-2xl bg-black/40 border border-white/10 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-pink-500 transition-all font-sans"
                    />
                    {searching && (
                      <span className="absolute right-4 top-3.5 text-xs text-slate-400 animate-spin">⏳</span>
                    )}
                  </div>

                  {searchResults.length === 0 && searchQuery.length >= 2 && !searching && (
                    <p className="text-xs text-slate-400 text-center py-6">
                      No members found matching &ldquo;{searchQuery}&rdquo;.
                    </p>
                  )}

                  <div className="space-y-3">
                    {searchResults.map((target) => (
                      <div
                        key={target.id}
                        className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between gap-4"
                      >
                        <div className="flex items-center space-x-3 overflow-hidden">
                          <div className="w-11 h-11 rounded-2xl overflow-hidden bg-slate-900 shrink-0 border border-white/10 flex items-center justify-center">
                            {target.avatarUrl ? (
                              <img
                                src={target.avatarUrl}
                                alt={`Profile picture for ${target.displayName || target.username}`}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-xl">{target.avatarEmoji}</span>
                            )}
                          </div>

                          <div className="overflow-hidden">
                            <div className="flex items-center gap-1.5">
                              <h4 className="text-sm font-bold text-white truncate">{target.displayName}</h4>
                              {target.hasVipUsername && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-gradient-to-r from-yellow-500 to-amber-500 text-slate-950 font-black flex items-center gap-0.5 select-none shrink-0">
                                  <Crown className="w-2.5 h-2.5 fill-current" /> VIP
                                </span>
                              )}
                            </div>
                            <p className="text-xs font-mono font-bold text-pink-400 truncate">@{target.username}</p>
                            <p className="text-[11px] text-slate-400 truncate">{target.bio || DEFAULT_BIO}</p>
                          </div>
                        </div>

                        {/* Relationship status buttons */}
                        <div className="shrink-0">
                          {target.relationshipStatus === 'FRIENDS' ? (
                            <span className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" />
                              <span>Friends</span>
                            </span>
                          ) : target.relationshipStatus === 'REQUEST_SENT' ? (
                            <span className="px-3 py-1.5 rounded-xl bg-white/5 text-slate-400 text-xs font-bold flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              <span>Requested</span>
                            </span>
                          ) : target.relationshipStatus === 'REQUEST_RECEIVED' ? (
                            <button
                              onClick={() => target.requestId && handleAcceptRequest(target.requestId)}
                              className="px-3.5 py-1.5 rounded-xl bg-emerald-500 text-white font-bold text-xs cursor-pointer shadow-md shadow-emerald-500/20 active:scale-95 transition-all"
                            >
                              Accept
                            </button>
                          ) : (
                            <button
                              onClick={() => handleSendRequest(target.id)}
                              disabled={actionLoading === target.id}
                              className="px-3.5 py-1.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md shadow-pink-500/20 active:scale-95 transition-all"
                            >
                              <UserPlus className="w-3.5 h-3.5" />
                              <span>Add Friend</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
