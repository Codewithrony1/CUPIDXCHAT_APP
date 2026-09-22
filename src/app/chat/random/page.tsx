'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useAuth as useClerkAuth } from '@clerk/nextjs';
import { useSocket } from '@/context/SocketContext';
import AppShell from '@/components/AppShell';
import nextDynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import {
  Heart,
  Send,
  Paperclip,
  CheckCheck,
  Flag,
  Crown,
  FastForward,
  X,
  Sparkles,
  Ban,
  MoreVertical,
  Loader2,
  AlertCircle,
  ShieldCheck,
  Radio,
  Eye,
  Lock,
} from 'lucide-react';
import SelfHostedVipModal from '@/components/payment/SelfHostedVipModal';
import { useChatViewport } from '@/hooks/useChatViewport';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { sanitizeChatText } from '@/lib/sanitizeChatText';

const ProfilePreviewSheet = nextDynamic(() => import('@/components/chat/ProfilePreviewSheet'), { ssr: false });

// ─── Types ────────────────────────────────────────────────────────────────────

export type ConnectionState =
  | 'IDLE'
  | 'SEARCHING'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'DISCONNECTING'
  | 'DISCONNECTED'
  | 'ERROR';

interface RandomPartner {
  id: string;
  username?: string;
  vipUsername?: string | null;
  fullName: string;
  displayName?: string;
  avatarType?: string;
  avatarEmoji?: string;
  avatarUrl?: string | null;
  gender: string;
  mood?: string;
  personalityPreferences?: string;
  bio?: string;
  isVIP: boolean;
  plan?: string;
  countryCode?: string;
  countryName?: string;
  countryFlag?: string;
}

interface RandomMessage {
  id: string;
  clientMessageId?: string | null;
  chatSessionId?: string;
  senderId: string;
  senderUsername: string;
  content: string;
  imageUrl: string | null;
  sequenceNumber?: number;
  createdAt: string;
  status?: 'SENDING' | 'SENT' | 'DELIVERED' | 'FAILED';
  deliveredAt?: string | null;
}

// ─── Memoized Message Bubble Item (Zero Re-render on Typing) ─────────────────

const RandomChatMessageItem = React.memo(function RandomChatMessageItem({
  msg,
  isMine,
  onImageClick,
  onRetry,
}: {
  msg: RandomMessage;
  isMine: boolean;
  onImageClick: (url: string) => void;
  onRetry?: (msg: RandomMessage) => void;
}) {
  const formattedTime = useMemo(() => {
    try {
      return new Date(msg.createdAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  }, [msg.createdAt]);

  return (
    <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} max-w-full`}>
      <div
        className={`max-w-[85%] sm:max-w-[70%] md:max-w-[65%] min-w-[72px] rounded-3xl p-3 sm:p-3.5 shadow-lg relative break-words [overflow-wrap:anywhere] [word-break:break-word] ${
          isMine
            ? 'bg-gradient-to-br from-pink-600 via-rose-500 to-purple-600 text-white rounded-tr-sm shadow-pink-500/10'
            : 'bg-slate-900/90 border border-slate-800 text-slate-100 rounded-tl-sm'
        }`}
      >
        {msg.imageUrl && (
          <div
            onClick={() => onImageClick(msg.imageUrl!)}
            className="mb-2 rounded-2xl overflow-hidden cursor-pointer group bg-black/40 border border-white/10 relative"
          >
            <img
              src={msg.imageUrl}
              alt={`Attachment from ${isMine ? 'you' : 'partner'}`}
              className="max-h-60 w-full max-w-full object-cover rounded-xl group-hover:scale-105 transition-transform"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <Eye className="w-5 h-5 text-white" />
            </div>
          </div>
        )}

        {msg.content && (
          <bdi className="block break-words [overflow-wrap:anywhere] [word-break:break-word] whitespace-pre-wrap text-xs sm:text-[13px] leading-relaxed select-text">
            {sanitizeChatText(msg.content)}
          </bdi>
        )}

        <div className="flex items-center justify-end space-x-1 mt-1 text-[9px] opacity-75 whitespace-nowrap select-none shrink-0">
          <span className="shrink-0">{formattedTime}</span>
          {isMine &&
            (msg.status === 'FAILED' ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRetry?.(msg);
                }}
                className="inline-flex items-center gap-0.5 text-rose-300 hover:text-rose-200 font-bold cursor-pointer transition-colors shrink-0"
                title="Failed to deliver. Click to retry."
              >
                <span>!</span>
                <span className="underline text-[8px]">Retry</span>
              </button>
            ) : msg.status === 'DELIVERED' ? (
              <span title="Delivered" className="inline-flex items-center shrink-0"><CheckCheck className="w-3.5 h-3.5 text-pink-300" /></span>
            ) : msg.status === 'SENT' ? (
              <span title="Sent" className="inline-flex items-center shrink-0"><CheckCheck className="w-3 h-3 text-white/80" /></span>
            ) : (
              <span className="text-[9px] text-white/60 inline-flex items-center shrink-0" title="Sending...">🕒</span>
            ))}
        </div>
      </div>
    </div>
  );
});

// ─── Memoized Message List Container (Zero Re-render on Typing) ──────────────

interface RandomChatMessageListProps {
  messages: RandomMessage[];
  partner: RandomPartner | null;
  currentUserId: string | null;
  currentUsername?: string | null;
  partnerTyping: boolean;
  onImageClick: (url: string) => void;
  onRetry?: (msg: RandomMessage) => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

const RandomChatMessageList = React.memo(function RandomChatMessageList({
  messages,
  partner,
  currentUserId,
  currentUsername,
  partnerTyping,
  onImageClick,
  onRetry,
  scrollRef,
  containerRef,
}: RandomChatMessageListProps) {
  return (
    <div
      ref={containerRef as any}
      className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 space-y-3 overscroll-contain min-h-0 select-text"
    >
      <div className="text-center my-2">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] text-slate-400 max-w-full truncate">
          <ShieldCheck className="w-3.5 h-3.5 text-pink-400 shrink-0" />
          <span className="truncate">Connected with {partner?.displayName || partner?.fullName || 'Stranger'} • Be polite &amp; respectful</span>
        </span>
      </div>

      {messages.length === 0 && (
        <div className="text-center py-12 text-slate-500 text-xs space-y-1 select-none">
          <p className="font-bold text-slate-400">You are connected!</p>
          <p>Say hello to start the conversation 👋</p>
        </div>
      )}

      {messages.map((msg, index) => {
        const isMine =
          Boolean(currentUserId && msg.senderId === currentUserId) ||
          Boolean(currentUsername && msg.senderUsername === currentUsername);

        return (
          <RandomChatMessageItem
            key={msg.id || msg.clientMessageId || index}
            msg={msg}
            isMine={isMine}
            onImageClick={onImageClick}
            onRetry={onRetry}
          />
        );
      })}

      {partnerTyping && (
        <div className="flex items-center space-x-2 text-xs text-slate-400 italic shrink-0 select-none">
          <div className="px-3 py-2 rounded-2xl bg-slate-900 border border-slate-800 flex items-center space-x-1 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-bounce" />
            <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-bounce [animation-delay:0.2s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-bounce [animation-delay:0.4s]" />
          </div>
          <span className="text-[10px] truncate">Partner is typing...</span>
        </div>
      )}

      <div ref={scrollRef as any} />
    </div>
  );
});

// ─── Component ────────────────────────────────────────────────────────────────

export default function KnotChatRandomPage() {
  const router = useRouter();
  const { user, loading, refreshUser } = useAuth();
  const { getToken } = useClerkAuth();
  const { socket, isConnected: socketConnected } = useSocket();

  const currentUser = user;

  // ── Core state ──
  const [matchStatus, setMatchStatus] = useState<'idle' | 'searching' | 'connected' | 'ended'>('idle');
  const [connectionState, setConnectionState] = useState<ConnectionState>('IDLE');
  const [partner, setPartner] = useState<RandomPartner | null>(null);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [messages, setMessages] = useState<RandomMessage[]>([]);
  const [reconnecting, setReconnecting] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [randomChatDisabled, setRandomChatDisabled] = useState(false);
  const [checkingAvailability, setCheckingAvailability] = useState(true);

  // ── Input & messaging ──
  const [inputText, setInputText] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);

  // ── Intro modal ──
  const [showIntroModal, setShowIntroModal] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(true);

  // ── Image attachment ──
  const [showVipModal, setShowVipModal] = useState(false);
  const [selectedImageFile, setSelectedImageFile] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedFullImage, setSelectedFullImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Options & safety modals ──
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showProfileSheet, setShowProfileSheet] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);

  // ── Refs ──
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Dynamic mobile keyboard & visual viewport adaptation (BUG-001)
  const { containerStyle } = useChatViewport({ scrollRef: messagesEndRef });

  // Modal focus traps (BUG-007)
  const introModalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(introModalRef, showIntroModal, () => setShowIntroModal(false));

  const reportModalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(reportModalRef, showReportModal, () => setShowReportModal(false));
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isCurrentlyTypingRef = useRef(false);
  const lastMessageSentTimeRef = useRef<number>(0);
  const isSkippingRef = useRef(false);
  const currentUidRef = useRef<string | null>(null);
  const activeMatchIdRef = useRef<string | null>(null);
  const autoStartExecutedRef = useRef(false);
  const serverlessPollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMatchmakingStartingRef = useRef(false);

  const isVIP = Boolean(
    (!currentUser?.vip_expires_at || new Date(currentUser.vip_expires_at).getTime() > Date.now()) &&
    (currentUser?.membershipTier === 'VIP' ||
      currentUser?.is_vip ||
      (currentUser?.subscription?.isActive === true && currentUser?.subscription?.plan === 'VIP'))
  );

  // Sync current user ID into ref
  useEffect(() => {
    currentUidRef.current = currentUser?.clerkUserId || currentUser?.id || null;
  }, [currentUser?.id, currentUser?.clerkUserId]);

  const chatScrollContainerRef = useRef<HTMLDivElement>(null);
  const handleImageClick = useCallback((url: string) => {
    setSelectedFullImage(url);
  }, []);

  const scrollToBottom = useCallback((smooth = true) => {
    if (typeof window === 'undefined') return;
    requestAnimationFrame(() => {
      const container = chatScrollContainerRef.current;
      if (container) {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: smooth ? 'smooth' : 'auto',
        });
      } else {
        messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
      }
    });
  }, []);

  // ─── Auto scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (matchStatus !== 'connected') return;
    const container = chatScrollContainerRef.current;
    if (!container) {
      scrollToBottom(false);
      return;
    }
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 250;
    const lastMsg = messages[messages.length - 1];
    const isMine = Boolean(
      lastMsg &&
      ((currentUidRef.current && lastMsg.senderId === currentUidRef.current) ||
        (currentUser?.username && lastMsg.senderUsername === currentUser.username))
    );
    if (isMine || isNearBottom) {
      scrollToBottom(true);
    }
  }, [messages.length, partnerTyping, matchStatus, scrollToBottom, currentUser?.username]);

  // ─── Auth redirect guard ───────────────────────────────────────────────────
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // ─── Socket Lifecycle & Event Listeners ────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const handleQueueJoined = () => {
      setConnectionState('SEARCHING');
      setMatchStatus('searching');
      setSearchError(null);
      setReconnecting(false);
    };

    const handleRandomMatchFound = (data: {
      matchId: string;
      roomId: string;
      partner: RandomPartner;
      reconnected?: boolean;
    }) => {
      console.log('[RANDOM_CHAT] Match established via Socket.IO:', data.matchId);
      isMatchmakingStartingRef.current = false;
      if (serverlessPollIntervalRef.current) {
        clearInterval(serverlessPollIntervalRef.current);
        serverlessPollIntervalRef.current = null;
      }
      setConnectionState('CONNECTING');
      activeMatchIdRef.current = data.matchId;
      setMatchId(data.matchId);
      setPartner(data.partner);
      setMatchStatus('connected');
      setConnectionState('CONNECTED');
      setReconnecting(false);
      if (!data.reconnected) {
        setMessages([]);
      }
    };

    const handleReceiveRandomMessage = (message: RandomMessage) => {
      // 1. Session ID crossover prevention: Drop messages belonging to older/other sessions
      const currentMid = activeMatchIdRef.current;
      if (!currentMid) return;
      if (message.chatSessionId && message.chatSessionId !== currentMid) {
        console.warn('[RANDOM_CHAT] Dropped message from mismatched session:', message.chatSessionId, 'Expected:', currentMid);
        return;
      }

      setMessages((prev) => {
        let nextState: RandomMessage[];
        if (message.clientMessageId) {
          const exists = prev.some((m) => m.clientMessageId === message.clientMessageId);
          if (exists) {
            nextState = prev.map((m) =>
              m.clientMessageId === message.clientMessageId ? { ...message, status: message.status || 'SENT' } : m
            );
          } else if (prev.some((m) => m.id === message.id)) {
            return prev;
          } else {
            nextState = [...prev, { ...message, status: message.status || 'SENT' }];
          }
        } else if (prev.some((m) => m.id === message.id)) {
          return prev;
        } else {
          nextState = [...prev, { ...message, status: message.status || 'SENT' }];
        }

        return nextState.sort((a, b) => {
          const seqA = a.sequenceNumber || (a.createdAt ? new Date(a.createdAt).getTime() : 0);
          const seqB = b.sequenceNumber || (b.createdAt ? new Date(b.createdAt).getTime() : 0);
          return seqA - seqB;
        });
      });

      // 2. Send Delivery Acknowledgement to sender if message is from partner
      const isFromPartner = message.senderId !== currentUidRef.current;
      if (isFromPartner) {
        if (socket && socket.connected) {
          socket.emit('ack_random_message_delivered', {
            messageId: message.id,
            clientMessageId: message.clientMessageId,
            chatSessionId: currentMid,
          });
        }
        fetch('/api/chat/messages/ack', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messageId: message.id,
            clientMessageId: message.clientMessageId,
            chatSessionId: currentMid,
          }),
        }).catch(() => {});
      }
    };

    const handleMessageDelivered = (data: {
      messageId?: string;
      clientMessageId?: string;
      chatSessionId?: string;
      deliveredAt?: string;
    }) => {
      if (data.chatSessionId && data.chatSessionId !== activeMatchIdRef.current) return;
      setMessages((prev) =>
        prev.map((m) => {
          if (
            (data.messageId && m.id === data.messageId) ||
            (data.clientMessageId && m.clientMessageId === data.clientMessageId)
          ) {
            return {
              ...m,
              status: 'DELIVERED',
              deliveredAt: data.deliveredAt || new Date().toISOString(),
            };
          }
          return m;
        })
      );
    };

    const handlePartnerTyping = (data: { isTyping: boolean }) => {
      setPartnerTyping(Boolean(data.isTyping));
    };

    const handlePartnerLeft = (data: { reason?: string }) => {
      console.log('[RANDOM_CHAT] Partner left:', data?.reason);
      activeMatchIdRef.current = null;
      setMatchId(null);
      setPartner(null);
      setMessages([]);
      setConnectionState('DISCONNECTED');
      setMatchStatus('ended');
      setPartnerTyping(false);
      setInputText('');
      setSelectedImageFile(null);
      setImagePreview(null);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      isCurrentlyTypingRef.current = false;
    };

    const handleChatEndedConfirm = () => {
      activeMatchIdRef.current = null;
      setMatchId(null);
      setPartner(null);
      setMessages([]);
      setConnectionState('DISCONNECTED');
      setMatchStatus('ended');
      setPartnerTyping(false);
      setInputText('');
      setSelectedImageFile(null);
      setImagePreview(null);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      isCurrentlyTypingRef.current = false;
    };

    const handleDisconnect = () => {
      setConnectionState('DISCONNECTED');
      if (activeMatchIdRef.current) {
        setReconnecting(true);
      }
    };

    const handleConnect = () => {
      setReconnecting(false);
      if (activeMatchIdRef.current) {
        setConnectionState('CONNECTED');
      } else {
        setConnectionState('IDLE');
      }
    };

    socket.on('queue_joined', handleQueueJoined);
    socket.on('random_match_found', handleRandomMatchFound);
    socket.on('receive_random_message', handleReceiveRandomMessage);
    socket.on('random_message_delivered', handleMessageDelivered);
    socket.on('partner_typing_status', handlePartnerTyping);
    socket.on('partner_left', handlePartnerLeft);
    socket.on('chat_ended_confirm', handleChatEndedConfirm);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect', handleConnect);

    return () => {
      socket.off('queue_joined', handleQueueJoined);
      socket.off('random_match_found', handleRandomMatchFound);
      socket.off('receive_random_message', handleReceiveRandomMessage);
      socket.off('random_message_delivered', handleMessageDelivered);
      socket.off('partner_typing_status', handlePartnerTyping);
      socket.off('partner_left', handlePartnerLeft);
      socket.off('chat_ended_confirm', handleChatEndedConfirm);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect', handleConnect);
    };
  }, [socket]);

  // ─── Cleanup on unmount & window unload ────────────────────────────────────
  useEffect(() => {
    // Do not end a user-wide match from beforeunload: another tab/socket may still be active.
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (socket && socket.connected && !activeMatchIdRef.current) {
        socket.emit('leave_random_queue');
      }
    };
  }, [socket]);

  // ─── START MATCHMAKING (Single-Transport Priority) ────────────────────────
  const handleStartMatch = useCallback(
    async (skipCurrent = false) => {
      // Concurrency Guard: Prevent double-click or simultaneous multi-match triggers
      if (isMatchmakingStartingRef.current) return;
      isMatchmakingStartingRef.current = true;

      setConnectionState('SEARCHING');
      setMatchStatus('searching');
      setPartner(null);
      setMessages([]);
      setMatchId(null);
      setSearchError(null);
      setReconnecting(false);
      activeMatchIdRef.current = null;

      if (serverlessPollIntervalRef.current) {
        clearInterval(serverlessPollIntervalRef.current);
        serverlessPollIntervalRef.current = null;
      }

      const preferences = {
        gender: currentUser?.profile?.gender || 'unspecified',
        preferredGender: currentUser?.profile?.preferredGender || 'auto',
        mood: currentUser?.profile?.mood || 'chill',
        language: currentUser?.profile?.language || 'english',
      };

      // 1. Single-Transport Priority:
      // If WebSocket is connected and live, use Socket queue exclusively
      if (socket && socket.connected) {
        socket.emit('join_random_queue', preferences);
        isMatchmakingStartingRef.current = false;
        return;
      }

      // 2. HTTP Fallback: Call serverless matchmaking API when Socket is unavailable
      try {
        const effectiveClerkId = currentUidRef.current || currentUser?.clerkUserId || currentUser?.id || '';
        const token = await getToken().catch(() => null);

        const res = await fetch('/api/matchmaking/join', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(effectiveClerkId ? { 'x-clerk-user-id': effectiveClerkId } : {}),
          },
          body: JSON.stringify({
            skipCurrentMatch: skipCurrent,
            ...preferences,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          if (res.status === 503 || errData.disabled) {
            setRandomChatDisabled(true);
            setSearchError('Random Chat is currently unavailable. Please try again later.');
            setConnectionState('ERROR');
            setMatchStatus('idle');
            isMatchmakingStartingRef.current = false;
            return;
          }
        } else {
          const data = await res.json();
          if (data.matched && data.chatSessionId) {
            if (serverlessPollIntervalRef.current) {
              clearInterval(serverlessPollIntervalRef.current);
              serverlessPollIntervalRef.current = null;
            }
            setConnectionState('CONNECTING');
            activeMatchIdRef.current = data.chatSessionId;
            setMatchId(data.chatSessionId);
            setPartner(data.partner);
            setMatchStatus('connected');
            setConnectionState('CONNECTED');
            setReconnecting(false);
            setMessages([]);
            isMatchmakingStartingRef.current = false;
            return;
          }
        }
      } catch (e) {
        console.warn('API matchmaking join notice:', e);
      } finally {
        isMatchmakingStartingRef.current = false;
      }

      // 3. Status Polling if socket remains unavailable
      if (!socket || !socket.connected) {
        serverlessPollIntervalRef.current = setInterval(async () => {
          if (activeMatchIdRef.current) {
            if (serverlessPollIntervalRef.current) {
              clearInterval(serverlessPollIntervalRef.current);
              serverlessPollIntervalRef.current = null;
            }
            return;
          }
          try {
            const effectiveClerkId = currentUidRef.current || currentUser?.clerkUserId || currentUser?.id || '';
            const statusRes = await fetch('/api/matchmaking/status', {
              headers: {
                ...(effectiveClerkId ? { 'x-clerk-user-id': effectiveClerkId } : {}),
              },
            });
            if (statusRes.ok) {
              const statusData = await statusRes.json();
              if (statusData.matched && statusData.chatSessionId) {
                if (serverlessPollIntervalRef.current) {
                  clearInterval(serverlessPollIntervalRef.current);
                  serverlessPollIntervalRef.current = null;
                }
                setConnectionState('CONNECTING');
                activeMatchIdRef.current = statusData.chatSessionId;
                setMatchId(statusData.chatSessionId);
                setPartner(statusData.partner);
                setMatchStatus('connected');
                setConnectionState('CONNECTED');
                setReconnecting(false);
                setMessages([]);
              }
            }
          } catch (e) {}
        }, 1200);
      }
    },
    [socket, currentUser, getToken]
  );

  // ─── Check availability & auto-start on mount when user is ready ──────────
  useEffect(() => {
    let isMounted = true;
    if (currentUser?.id && !autoStartExecutedRef.current) {
      autoStartExecutedRef.current = true;
      fetch('/api/settings/random-chat')
        .then((res) => res.json())
        .then((data) => {
          if (!isMounted) return;
          setCheckingAvailability(false);
          if (data && data.enabled === false) {
            setRandomChatDisabled(true);
            setSearchError('Random Chat is currently unavailable. Please try again later.');
            setConnectionState('ERROR');
            setMatchStatus('idle');
          } else {
            setRandomChatDisabled(false);
            const hasSeenIntro = (currentUser as any)?.profile?.randomChatIntroSeen;
            if (!hasSeenIntro) {
              setShowIntroModal(true);
            } else {
              handleStartMatch();
            }
          }
        })
        .catch(() => {
          if (isMounted) {
            setCheckingAvailability(false);
            handleStartMatch();
          }
        });
    }
    return () => {
      isMounted = false;
    };
  }, [currentUser?.id, handleStartMatch]);

  // ─── CANCEL SEARCH ─────────────────────────────────────────────────────────
  const handleCancelSearch = async () => {
    isMatchmakingStartingRef.current = false;
    activeMatchIdRef.current = null;
    setConnectionState('IDLE');
    setMatchStatus('idle');
    if (serverlessPollIntervalRef.current) {
      clearInterval(serverlessPollIntervalRef.current);
      serverlessPollIntervalRef.current = null;
    }
    if (socket && socket.connected) {
      socket.emit('leave_random_queue');
    }
    const effectiveClerkId = currentUidRef.current || currentUser?.clerkUserId || currentUser?.id || '';
    const token = await getToken().catch(() => null);
    fetch('/api/matchmaking/cancel', {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(effectiveClerkId ? { 'x-clerk-user-id': effectiveClerkId } : {}),
      },
    }).catch(() => {});
  };

  // ─── NEXT PARTNER (Requirement 3: Clean up old, brand-new room, different partner) ─
  const handleNextPartner = async () => {
    if (isSkippingRef.current) return;
    isSkippingRef.current = true;
    setTimeout(() => {
      isSkippingRef.current = false;
    }, 400);

    const oldMid = activeMatchIdRef.current || matchId;
    activeMatchIdRef.current = null;
    setMatchId(null);
    setPartner(null);
    setMessages([]);
    setPartnerTyping(false);
    setInputText('');
    setSelectedImageFile(null);
    setImagePreview(null);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    isCurrentlyTypingRef.current = false;
    setConnectionState('DISCONNECTING');

    if (serverlessPollIntervalRef.current) {
      clearInterval(serverlessPollIntervalRef.current);
      serverlessPollIntervalRef.current = null;
    }

    if (oldMid) {
      const effectiveClerkId = currentUidRef.current || currentUser?.clerkUserId || currentUser?.id || '';
      const token = await getToken().catch(() => null);
      fetch(`/api/chat/${oldMid}/next`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(effectiveClerkId ? { 'x-clerk-user-id': effectiveClerkId } : {}),
        },
      }).catch(() => {});
    }

    setConnectionState('SEARCHING');
    setMatchStatus('searching');

    if (socket && socket.connected) {
      socket.emit('next_partner', {
        gender: currentUser?.profile?.gender || 'unspecified',
        preferredGender: currentUser?.profile?.preferredGender || 'auto',
      });
    } else {
      handleStartMatch(true);
    }
  };

  const handleEndChat = async () => {
    setShowOptionsMenu(false);
    const oldMid = activeMatchIdRef.current || matchId;
    activeMatchIdRef.current = null;
    setMatchId(null);
    setPartner(null);
    setMessages([]);
    setPartnerTyping(false);
    setInputText('');
    setSelectedImageFile(null);
    setImagePreview(null);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    isCurrentlyTypingRef.current = false;
    setConnectionState('DISCONNECTING');

    if (serverlessPollIntervalRef.current) {
      clearInterval(serverlessPollIntervalRef.current);
      serverlessPollIntervalRef.current = null;
    }

    if (socket && socket.connected) {
      socket.emit('end_random_chat');
    }
    if (oldMid) {
      const effectiveClerkId = currentUidRef.current || currentUser?.clerkUserId || currentUser?.id || '';
      const token = await getToken().catch(() => null);
      fetch(`/api/chat/${oldMid}/end`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(effectiveClerkId ? { 'x-clerk-user-id': effectiveClerkId } : {}),
        },
      }).catch(() => {});
    }
    setConnectionState('DISCONNECTED');
    setMatchStatus('ended');
  };

  // ─── SEND MESSAGE ─────────────────────────────────────────────────────────
  const handleSendMessage = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      if ('stopPropagation' in e) e.stopPropagation();
    }
    if ((!inputText.trim() && !selectedImageFile) || matchStatus !== 'connected' || sendingMsg) return;
    const activeMid = activeMatchIdRef.current || matchId;
    if (!activeMid) return;

    const now = Date.now();
    if (now - lastMessageSentTimeRef.current < 250) {
      return;
    }
    lastMessageSentTimeRef.current = now;

    const textToSend = inputText.trim();
    if (textToSend.length > 2000) {
      alert('Message exceeds the maximum limit of 2,000 characters.');
      return;
    }

    const senderUid = currentUser?.id || currentUidRef.current || 'me';
    const senderDisplayName = currentUser?.displayName || currentUser?.fullName || 'Stranger';
    const imageToSend = selectedImageFile;

    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const tempMessage: RandomMessage = {
      id: tempId,
      clientMessageId: tempId,
      senderId: senderUid,
      senderUsername: senderDisplayName,
      content: textToSend,
      imageUrl: imagePreview || null,
      createdAt: new Date().toISOString(),
      status: 'SENDING',
    };

    setMessages((prev) => [...prev, tempMessage]);
    setInputText('');
    setSelectedImageFile(null);
    setImagePreview(null);
    setSendingMsg(true);

    // 15-second delivery watchdog: If a message is still 'SENDING' after 15s, mark as 'FAILED'
    setTimeout(() => {
      setMessages((prev) =>
        prev.map((m) =>
          (m.id === tempId || m.clientMessageId === tempId) && m.status === 'SENDING'
            ? { ...m, status: 'FAILED' as const }
            : m
        )
      );
    }, 15000);

    if (isCurrentlyTypingRef.current) {
      isCurrentlyTypingRef.current = false;
      if (socket && socket.connected) {
        socket.emit('random_typing_status', { isTyping: false });
      }
    }

    try {
      if (imageToSend) {
        const token = await getToken().catch(() => null);
        const effectiveClerkId = currentUidRef.current || currentUser?.clerkUserId || currentUser?.id || '';
        const uploadRes = await fetch('/api/chat/upload-image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(effectiveClerkId ? { 'x-clerk-user-id': effectiveClerkId } : {}),
          },
          body: JSON.stringify({
            matchId: activeMid,
            content: textToSend,
            imageData: imageToSend,
            clientMessageId: tempId,
          }),
        });

        const uploadData = await uploadRes.json().catch(() => ({}));
        if (!uploadRes.ok) {
          if (uploadRes.status === 403 || uploadData.isVipRequired) {
            setShowVipModal(true);
          }
          throw new Error(uploadData.error || 'Failed to upload photo.');
        }

        if (socket && socket.connected) {
          socket.emit(
            'send_random_message',
            {
              chatSessionId: activeMid,
              content: textToSend,
              imageUrl: uploadData.imageUrl || null,
              clientMessageId: tempId,
            },
            (res: any) => {
              if (res?.success) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.clientMessageId === tempId || m.id === tempId
                      ? { ...m, id: res.message?.id || tempId, status: 'SENT' as const }
                      : m
                  )
                );
              } else {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.clientMessageId === tempId || m.id === tempId
                      ? { ...m, status: 'FAILED' as const }
                      : m
                  )
                );
              }
            }
          );
        } else {
          // Socket unavailable: persist the uploaded image through the canonical message API.
          const token = await getToken().catch(() => null);
          const effectiveClerkId = currentUidRef.current || currentUser?.clerkUserId || currentUser?.id || '';
          const postRes = await fetch('/api/chat/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
              ...(effectiveClerkId ? { 'x-clerk-user-id': effectiveClerkId } : {}),
            },
            body: JSON.stringify({
              chatSessionId: activeMid,
              content: textToSend,
              imageUrl: uploadData.imageUrl || null,
              clientMessageId: tempId,
            }),
          });
          if (!postRes.ok) throw new Error((await postRes.json().catch(() => ({}))).error || 'Failed to send photo.');
          const postData = await postRes.json().catch(() => ({}));
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempId || m.clientMessageId === tempId
                ? { ...m, id: postData.message?.id || tempId, status: 'SENT' as const }
                : m
            )
          );
        }
      } else {
        if (socket && socket.connected) {
          socket.emit(
            'send_random_message',
            {
              chatSessionId: activeMid,
              content: textToSend,
              clientMessageId: tempId,
            },
            (res: any) => {
              if (res?.success) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.clientMessageId === tempId || m.id === tempId
                      ? {
                          ...m,
                          id: res.message?.id || tempId,
                          sequenceNumber: res.message?.sequenceNumber || Date.now(),
                          status: 'SENT' as const,
                        }
                      : m
                  )
                );
              } else {
                console.warn('[RANDOM_CHAT] Socket message send error:', res?.error);
                setMessages((prev) =>
                  prev.map((m) =>
                    m.clientMessageId === tempId || m.id === tempId
                      ? { ...m, status: 'FAILED' as const }
                      : m
                  )
                );
              }
            }
          );
        } else {
          // Fallback to HTTP POST
          const token = await getToken().catch(() => null);
          const effectiveClerkId = currentUidRef.current || currentUser?.clerkUserId || currentUser?.id || '';
          const postRes = await fetch('/api/chat/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
              ...(effectiveClerkId ? { 'x-clerk-user-id': effectiveClerkId } : {}),
            },
            body: JSON.stringify({
              chatSessionId: activeMid,
              content: textToSend,
              clientMessageId: tempId,
            }),
          });
          if (postRes.ok) {
            const postData = await postRes.json().catch(() => ({}));
            setMessages((prev) =>
              prev.map((m) =>
                m.id === tempId || m.clientMessageId === tempId
                  ? {
                      ...m,
                      id: postData.message?.id || tempId,
                      sequenceNumber: postData.message?.sequenceNumber || Date.now(),
                      status: 'SENT' as const,
                    }
                  : m
              )
            );
          } else {
            const errData = await postRes.json().catch(() => ({}));
            console.warn('[RANDOM_CHAT] Message send failed:', errData?.error);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === tempId || m.clientMessageId === tempId
                  ? { ...m, status: 'FAILED' as const }
                  : m
              )
            );
          }
        }
      }
    } catch (err: any) {
      console.warn('Send message notice:', err?.message || err);
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId || m.clientMessageId === tempId ? { ...m, status: 'FAILED' as const } : m))
      );
    } finally {
      setSendingMsg(false);
    }
  };

  // ─── RETRY FAILED MESSAGE ──────────────────────────────────────────────────
  const handleRetryMessage = useCallback(
    async (failedMsg: RandomMessage) => {
      const activeMid = activeMatchIdRef.current || matchId;
      if (!activeMid || matchStatus !== 'connected') return;

      const retryKey = failedMsg.clientMessageId || failedMsg.id;

      // Set status back to SENDING
      setMessages((prev) =>
        prev.map((m) =>
          m.id === failedMsg.id || m.clientMessageId === retryKey
            ? { ...m, status: 'SENDING' as const }
            : m
        )
      );

      // 15-second retry watchdog
      setTimeout(() => {
        setMessages((prev) =>
          prev.map((m) =>
            (m.id === retryKey || m.clientMessageId === retryKey) && m.status === 'SENDING'
              ? { ...m, status: 'FAILED' as const }
              : m
          )
        );
      }, 15000);

      try {
        if (socket && socket.connected) {
          socket.emit(
            'send_random_message',
            {
              chatSessionId: activeMid,
              content: failedMsg.content,
              imageUrl: failedMsg.imageUrl,
              clientMessageId: retryKey,
            },
            (res: any) => {
              if (res?.success) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === failedMsg.id || m.clientMessageId === retryKey
                      ? {
                          ...m,
                          id: res.message?.id || failedMsg.id,
                          sequenceNumber: res.message?.sequenceNumber || Date.now(),
                          status: 'SENT' as const,
                        }
                      : m
                  )
                );
              } else {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === failedMsg.id || m.clientMessageId === retryKey
                      ? { ...m, status: 'FAILED' as const }
                      : m
                  )
                );
              }
            }
          );
        } else {
          const token = await getToken().catch(() => null);
          const effectiveClerkId = currentUidRef.current || currentUser?.clerkUserId || currentUser?.id || '';
          const postRes = await fetch('/api/chat/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
              ...(effectiveClerkId ? { 'x-clerk-user-id': effectiveClerkId } : {}),
            },
            body: JSON.stringify({
              chatSessionId: activeMid,
              content: failedMsg.content,
              imageUrl: failedMsg.imageUrl,
              clientMessageId: retryKey,
            }),
          });

          if (postRes.ok) {
            const postData = await postRes.json().catch(() => ({}));
            setMessages((prev) =>
              prev.map((m) =>
                m.id === failedMsg.id || m.clientMessageId === retryKey
                  ? {
                      ...m,
                      id: postData.message?.id || failedMsg.id,
                      sequenceNumber: postData.message?.sequenceNumber || Date.now(),
                      status: 'SENT' as const,
                    }
                  : m
              )
            );
          } else {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === failedMsg.id || m.clientMessageId === retryKey
                  ? { ...m, status: 'FAILED' as const }
                  : m
              )
            );
          }
        }
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === failedMsg.id || m.clientMessageId === retryKey
              ? { ...m, status: 'FAILED' as const }
              : m
          )
        );
      }
    },
    [socket, matchId, matchStatus, getToken, currentUser]
  );

  // ─── Realtime HTTP Message & Session Sync (when socket is disconnected) ────
  useEffect(() => {
    if (matchStatus !== 'connected' || !matchId) return;
    if (socketConnected) return;

    const interval = setInterval(async () => {
      const currentMid = activeMatchIdRef.current || matchId;
      if (!currentMid) return;

      try {
        const effectiveClerkId = currentUidRef.current || currentUser?.clerkUserId || currentUser?.id || '';
        const res = await fetch(`/api/chat/messages?chatSessionId=${currentMid}`, {
          headers: {
            ...(effectiveClerkId ? { 'x-clerk-user-id': effectiveClerkId } : {}),
          },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.sessionStatus === 'ENDED') {
            activeMatchIdRef.current = null;
            setMatchId(null);
            setPartner(null);
            setMessages([]);
            setConnectionState('DISCONNECTED');
            setMatchStatus('ended');
            setPartnerTyping(false);
            return;
          }
          if (Array.isArray(data.messages)) {
            setMessages((prev) => {
              const incomingMap = new Map<string, any>(data.messages.map((m: any) => [m.id, m]));
              const incomingByClient = new Map<string, any>(
                data.messages.filter((m: any) => m.clientMessageId).map((m: any) => [m.clientMessageId, m])
              );

              // 1. Update existing messages with any status updates (e.g. DELIVERED)
              const updated = prev.map((m) => {
                const inc: any = incomingMap.get(m.id) || (m.clientMessageId ? incomingByClient.get(m.clientMessageId) : null);
                if (inc && inc.status && inc.status !== m.status) {
                  return { ...m, status: inc.status, deliveredAt: inc.deliveredAt || m.deliveredAt };
                }
                return m;
              });

              // 2. Append newly arrived messages
              const existingIds = new Set(updated.map((m) => m.id));
              const existingClientIds = new Set(updated.map((m) => m.clientMessageId).filter(Boolean));
              const newMsgs = data.messages.filter(
                (m: any) => !existingIds.has(m.id) && (!m.clientMessageId || !existingClientIds.has(m.clientMessageId))
              );

              if (newMsgs.length === 0) return updated;

              // Acknowledge receipt of partner messages
              const partnerMsgs = newMsgs.filter((m: any) => m.senderId !== currentUidRef.current);
              partnerMsgs.forEach((pm: any) => {
                fetch('/api/chat/messages/ack', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    messageId: pm.id,
                    clientMessageId: pm.clientMessageId,
                    chatSessionId: currentMid,
                  }),
                }).catch(() => {});
              });

              const allMerged = [
                ...updated,
                ...newMsgs.map((m: any) => ({
                  id: m.id,
                  clientMessageId: m.clientMessageId,
                  chatSessionId: m.chatSessionId || currentMid,
                  senderId: m.senderId,
                  senderUsername: m.senderUsername || 'Stranger',
                  content: m.content,
                  imageUrl: m.imageUrl,
                  sequenceNumber: m.sequenceNumber || (m.createdAt ? new Date(m.createdAt).getTime() : 0),
                  createdAt: m.createdAt,
                  status: (m.status || 'SENT') as any,
                  deliveredAt: m.deliveredAt,
                })),
              ];

              allMerged.sort((a, b) => {
                const seqA = a.sequenceNumber || (a.createdAt ? new Date(a.createdAt).getTime() : 0);
                const seqB = b.sequenceNumber || (b.createdAt ? new Date(b.createdAt).getTime() : 0);
                return seqA - seqB;
              });

              return allMerged;
            });
          }
        }
      } catch (e) {}
    }, 1500);

    return () => clearInterval(interval);
  }, [matchStatus, matchId, socketConnected, currentUser?.id, currentUser?.clerkUserId]);

  // ─── TYPING INDICATOR (Pure local input, throttled socket emit, zero reconnect) ──
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputText(val);

    if (socket && socket.connected && matchStatus === 'connected') {
      if (!isCurrentlyTypingRef.current) {
        isCurrentlyTypingRef.current = true;
        socket.emit('random_typing_status', { isTyping: true });
      }
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        isCurrentlyTypingRef.current = false;
        if (socket && socket.connected) {
          socket.emit('random_typing_status', { isTyping: false });
        }
      }, 1500);
    }
  };

  // ─── IMAGE ATTACHMENT ─────────────────────────────────────────────────────
  const handleImageAttachmentClick = () => {
    if (!isVIP) {
      setShowVipModal(true);
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const fileName = file.name.toLowerCase();
    const hasValidExt = validExtensions.some((ext) => fileName.endsWith(ext));

    if (!validImageTypes.includes(file.type.toLowerCase()) || !hasValidExt) {
      alert('Only image files (JPG, JPEG, PNG, WEBP, GIF) are allowed. PDFs, documents, archives, and scripts are strictly rejected.');
      e.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Image size exceeds 5MB limit.');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setSelectedImageFile(result);
      setImagePreview(result);
    };
    reader.readAsDataURL(file);
  };

  // ─── INTRO MODAL ──────────────────────────────────────────────────────────
  const handleDismissIntro = async () => {
    setShowIntroModal(false);
    if (dontShowAgain) {
      fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ randomChatIntroSeen: true }),
      }).catch(() => {});
    }
    handleStartMatch();
  };

  // ─── REPORT & BLOCK ───────────────────────────────────────────────────────
  const handleReportPartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partner || !reportReason.trim()) return;
    setReportSubmitting(true);
    try {
      const res = await fetch('/api/chat/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportedUserId: partner.id,
          reason: reportReason,
          chatSessionId: activeMatchIdRef.current || matchId,
        }),
      });
      if (res.ok) {
        setReportSuccess(true);
        setTimeout(() => {
          setShowReportModal(false);
          setReportSuccess(false);
          setReportReason('');
          handleNextPartner();
        }, 1500);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setReportSubmitting(false);
    }
  };

  const handleBlockPartner = async () => {
    if (!partner) return;
    if (!isVIP) {
      setShowOptionsMenu(false);
      setShowVipModal(true);
      return;
    }
    try {
      const res = await fetch('/api/chat/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockedUserId: partner.id }),
      });
      if (res.status === 403) {
        setShowOptionsMenu(false);
        setShowVipModal(true);
        return;
      }
      setShowOptionsMenu(false);
      handleNextPartner();
    } catch (e) {
      console.error(e);
    }
  };

  // ─── RENDER ────────────────────────────────────────────────────────────────

  return (
    <AppShell
      showNav={matchStatus === 'idle'}
      showHeader={matchStatus === 'idle'}
      fullHeightChat={matchStatus !== 'idle'}
      containerStyle={matchStatus !== 'idle' ? containerStyle : undefined}
    >
      <div
        className="flex-1 flex flex-col bg-[#07000e] text-white overflow-hidden relative font-sans w-full h-full min-h-0"
      >
        {/* ================================================================= */}
        {/* 1. IDLE / START SCREEN                                            */}
        {/* ================================================================= */}
        {matchStatus === 'idle' && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-8 max-w-md mx-auto">
            <div className="relative">
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-pink-600 via-purple-600 to-indigo-600 flex items-center justify-center shadow-2xl shadow-pink-500/30 animate-pulse">
                <Heart className="w-12 h-12 text-white fill-white" />
              </div>
              <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-[#07000e] flex items-center justify-center text-[10px] font-bold">
                ●
              </span>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-black text-white">Live Random Chat</h2>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Connect instantly with verified people. Real-time, anonymous, safe.
              </p>
            </div>

            {searchError && (
              <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium">
                {searchError}
              </div>
            )}

            {randomChatDisabled ? (
              <div className="w-full space-y-3">
                <div className="p-4 rounded-3xl bg-rose-500/10 border border-rose-500/30 text-center space-y-1.5">
                  <div className="text-sm font-black text-rose-300 uppercase tracking-wider flex items-center justify-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400" />
                    <span>Random Chat Unavailable</span>
                  </div>
                  <p className="text-xs text-rose-200/90 font-medium">
                    Random Chat is currently unavailable. Please try again later.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    setCheckingAvailability(true);
                    try {
                      const res = await fetch('/api/settings/random-chat');
                      const data = await res.json();
                      if (data.enabled) {
                        setRandomChatDisabled(false);
                        setSearchError(null);
                        handleStartMatch();
                      } else {
                        setRandomChatDisabled(true);
                        setSearchError('Random Chat is currently unavailable. Please try again later.');
                      }
                    } catch (e) {}
                    setCheckingAvailability(false);
                  }}
                  disabled={checkingAvailability}
                  className="w-full py-3.5 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs uppercase tracking-wider border border-white/10 transition-all cursor-pointer disabled:opacity-50"
                >
                  {checkingAvailability ? 'Checking Availability...' : 'Check Availability Again'}
                </button>
              </div>
            ) : (
              <button
                onClick={() => handleStartMatch()}
                className="w-full py-4 rounded-3xl bg-gradient-to-r from-pink-600 via-rose-500 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-black text-sm uppercase tracking-wider shadow-2xl shadow-pink-500/30 flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
              >
                <Sparkles className="w-5 h-5" />
                <span>START RANDOM CHAT</span>
              </button>
            )}

            <div className="flex items-center space-x-4 text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-4 h-4 text-pink-400" />
                <span>100% Authenticated</span>
              </span>
              <span className="flex items-center gap-1">
                <Crown className="w-4 h-4 text-yellow-400 fill-current" />
                <span>VIP Priority</span>
              </span>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* 2. SEARCHING                                                       */}
        {/* ================================================================= */}
        {matchStatus === 'searching' && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-8 max-w-md mx-auto">
            <div className="relative w-36 h-36 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-pink-500/20 animate-ping" />
              <div className="absolute inset-3 rounded-full bg-purple-600/30 animate-pulse" />
              <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-pink-600 to-purple-600 flex items-center justify-center shadow-2xl shadow-pink-500/40 relative z-10">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-black text-white">Finding someone...</h3>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Scanning for another person to chat with. Connecting you in real time as soon as someone joins...
              </p>
            </div>

            {searchError && (
              <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium">
                {searchError}
              </div>
            )}

            <button
              onClick={handleCancelSearch}
              className="px-6 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 text-xs font-bold transition-all cursor-pointer"
            >
              Cancel Search
            </button>
          </div>
        )}

        {/* ================================================================= */}
        {/* 3. CONNECTED — CHAT                                               */}
        {/* ================================================================= */}
        {matchStatus === 'connected' && (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* HEADER */}
            <header className="px-3 sm:px-4 py-2.5 sm:py-3 bg-[#0d0119]/95 backdrop-blur-xl border-b border-pink-500/20 flex items-center justify-between z-30 shrink-0 shadow-md gap-2">
              <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0 flex-1">
                <div onClick={() => setShowProfileSheet(true)} className="relative cursor-pointer shrink-0">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-tr from-pink-600 to-purple-600 flex items-center justify-center text-white font-black text-xs sm:text-sm border-2 border-pink-400/50 shadow-md overflow-hidden shrink-0">
                    {partner?.avatarUrl ? (
                      <img
                        src={partner.avatarUrl}
                        alt={`Profile picture of ${partner?.displayName || partner?.fullName || 'Stranger'}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      partner?.avatarEmoji || (partner?.displayName ? partner.displayName.substring(0, 2).toUpperCase() : '👤')
                    )}
                  </div>
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-emerald-500 border-2 border-[#0d0119]" />
                </div>

                <div onClick={() => setShowProfileSheet(true)} className="cursor-pointer min-w-0 flex-1 overflow-hidden">
                  <div className="flex items-center space-x-1.5 min-w-0">
                    <h3 className="text-xs sm:text-sm font-black text-white truncate">
                      {partner?.displayName || partner?.fullName || 'Stranger'}
                    </h3>
                    {partner?.countryFlag && (
                      <span className="text-xs shrink-0 select-none" title={partner?.countryName || undefined}>
                        {partner.countryFlag}
                      </span>
                    )}
                    {partner?.isVIP && (
                      <Crown className="w-3.5 h-3.5 text-yellow-400 fill-current shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center space-x-1.5 text-[10px] min-w-0 text-slate-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
                    <span className="text-emerald-400 font-bold truncate shrink-0">
                      {partnerTyping ? 'typing...' : connectionState === 'CONNECTING' ? 'Connecting...' : 'Connected'}
                    </span>
                    {partner?.countryName && (
                      <span className="text-slate-400 font-medium hidden sm:inline truncate">
                        • {partner.countryName}
                      </span>
                    )}
                    {(reconnecting || connectionState === 'DISCONNECTED') && (
                      <span className="text-amber-400 font-bold truncate shrink-0">(reconnecting...)</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Header actions */}
              <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
                <button
                  onClick={handleNextPartner}
                  className="px-2.5 sm:px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white text-[11px] sm:text-xs font-black shadow-md shadow-pink-500/20 flex items-center gap-1 transition-all active:scale-95 cursor-pointer shrink-0"
                >
                  <span>NEXT</span>
                  <FastForward className="w-3.5 h-3.5" />
                </button>

                <div className="relative shrink-0">
                  <button
                    onClick={() => setShowOptionsMenu(!showOptionsMenu)}
                    className="p-1.5 sm:p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {showOptionsMenu && (
                    <div className="absolute right-0 mt-2 w-44 rounded-2xl bg-[#140024] border border-pink-500/30 shadow-2xl p-1.5 z-50 space-y-1 text-xs font-bold">
                      <button
                        onClick={() => {
                          setShowOptionsMenu(false);
                          setShowReportModal(true);
                        }}
                        className="w-full px-3 py-2 rounded-xl text-left text-slate-300 hover:text-white hover:bg-white/5 flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <Flag className="w-3.5 h-3.5 text-amber-400" />
                        <span>Report Partner</span>
                      </button>
                      <button
                        onClick={handleBlockPartner}
                        className="w-full px-3 py-2 rounded-xl text-left text-rose-300 hover:text-rose-200 hover:bg-rose-500/10 flex items-center justify-between transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <Ban className="w-3.5 h-3.5 text-rose-400" />
                          <span>Block &amp; Skip</span>
                        </div>
                        {!isVIP && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-300 font-extrabold border border-yellow-500/30 flex items-center gap-0.5">
                            <Lock className="w-2.5 h-2.5" /> VIP
                          </span>
                        )}
                      </button>
                      <button
                        onClick={handleEndChat}
                        className="w-full px-3 py-2 rounded-xl text-left text-slate-400 hover:text-white hover:bg-white/5 flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>End Chat</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </header>

            {/* MESSAGES */}
            <RandomChatMessageList
              messages={messages}
              partner={partner}
              currentUserId={currentUidRef.current || currentUser?.id || null}
              currentUsername={currentUser?.username}
              partnerTyping={partnerTyping}
              onImageClick={handleImageClick}
              onRetry={handleRetryMessage}
              scrollRef={messagesEndRef}
              containerRef={chatScrollContainerRef}
            />

            {/* IMAGE PREVIEW */}
            {imagePreview && (
              <div className="p-3 bg-[#10001f] border-t border-pink-500/20 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <img
                    src={imagePreview}
                    alt="Photo upload preview"
                    className="w-12 h-12 rounded-xl object-cover border border-white/20"
                  />
                  <span className="text-xs font-bold text-pink-300">Ready to send photo</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setImagePreview(null);
                    setSelectedImageFile(null);
                  }}
                  className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* COMPOSER */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleSendMessage(e);
              }}
              className="p-2.5 sm:p-3 pb-[calc(0.6rem+env(safe-area-inset-bottom))] sm:pb-3 bg-[#0d0119]/95 backdrop-blur-xl border-t border-pink-500/20 flex items-center space-x-2 z-30 shrink-0 w-full"
            >
              {!isVIP ? (
                <button
                  type="button"
                  onClick={() => setShowVipModal(true)}
                  className="px-2 sm:px-2.5 py-2 rounded-2xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 flex items-center gap-1 transition-all cursor-pointer shrink-0 shadow-sm"
                  title="Photo sharing is a VIP feature. Upgrade to VIP to send photos in random chats."
                >
                  <span className="text-sm leading-none">📷</span>
                  <span className="text-xs leading-none">🔒</span>
                  <span className="hidden sm:inline font-extrabold uppercase text-[10px] tracking-wider text-yellow-400">VIP</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleImageAttachmentClick}
                  className="p-2 sm:p-2.5 rounded-2xl bg-pink-500/20 hover:bg-pink-500/30 text-pink-300 hover:text-white border border-pink-500/30 transition-all cursor-pointer shrink-0"
                  title="Send photo"
                >
                  <span className="text-base leading-none">📷</span>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleFileChange}
                className="hidden"
              />

              <input
                type="text"
                placeholder="Type a message..."
                value={inputText}
                onChange={handleInputChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSendMessage();
                  }
                }}
                className="flex-1 min-w-0 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-2xl bg-slate-900 border border-slate-800 text-[15px] sm:text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-pink-500"
              />

              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSendMessage();
                }}
                disabled={sendingMsg || (!inputText.trim() && !selectedImageFile)}
                className="p-2.5 sm:p-2.5 rounded-2xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white shadow-md shadow-pink-500/30 transition-all active:scale-95 disabled:opacity-40 cursor-pointer shrink-0"
                aria-label="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {/* ================================================================= */}
        {/* 4. ENDED                                                          */}
        {/* ================================================================= */}
        {matchStatus === 'ended' && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-6 max-w-md mx-auto">
            <div className="w-16 h-16 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400">
              <AlertCircle className="w-8 h-8 text-pink-400" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-lg font-black text-white">Connection Ended</h3>
              <p className="text-sm font-bold text-pink-400">
                Your stranger has disconnected.
              </p>
              <p className="text-xs text-slate-400">
                Your ephemeral chat has ended. Click below to start a new random conversation.
              </p>
            </div>

            <button
              onClick={() => handleStartMatch(true)}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-pink-600 to-purple-600 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-pink-500/20 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
            >
              <FastForward className="w-4 h-4" />
              <span>Find Someone New</span>
            </button>
          </div>
        )}
      </div>

      {/* INTRO MODAL */}
      {showIntroModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <motion.div
            ref={introModalRef}
            role="dialog"
            aria-modal="true"
            aria-label="How CupidX Chat Works"
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md rounded-3xl bg-[#120021] border border-pink-500/30 p-6 space-y-5 shadow-2xl"
          >
            <div className="w-12 h-12 rounded-2xl bg-pink-500/20 border border-pink-500/30 text-pink-300 flex items-center justify-center mx-auto">
              <ShieldCheck className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-black text-white">How CupidX Chat Works</h3>
              <p className="text-xs text-slate-400">Quick safety tips before starting your anonymous random chat:</p>
            </div>

            <div className="space-y-2.5 text-xs text-slate-300 bg-black/40 p-4 rounded-2xl border border-white/5">
              <div className="flex items-start space-x-2">
                <span>🔒</span>
                <span>Your private details are never shared with your partner.</span>
              </div>
              <div className="flex items-start space-x-2">
                <span>⏭</span>
                <span>Click <strong>NEXT</strong> anytime to instantly disconnect and find someone new.</span>
              </div>
              <div className="flex items-start space-x-2">
                <span>🚩</span>
                <span>Report or block inappropriate behavior directly from the chat menu.</span>
              </div>
            </div>

            <label className="flex items-center space-x-2.5 text-xs text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="rounded border-slate-700 text-pink-600 focus:ring-pink-500"
              />
              <span>Don&apos;t show this tutorial again</span>
            </label>

            <button
              type="button"
              onClick={handleDismissIntro}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-pink-600 to-purple-600 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-pink-500/20 cursor-pointer"
            >
              Continue &amp; Start Chat
            </button>
          </motion.div>
        </div>
      )}

      {/* REPORT MODAL */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div
            ref={reportModalRef}
            role="dialog"
            aria-modal="true"
            aria-label="Report Partner"
            tabIndex={-1}
            className="w-full max-w-md rounded-3xl bg-[#120021] border border-rose-500/30 p-6 space-y-4 shadow-2xl"
          >
            <h4 className="text-sm font-black text-white flex items-center gap-2">
              <Flag className="w-4 h-4 text-rose-400" />
              <span>Report @{partner?.username}</span>
            </h4>

            {reportSuccess ? (
              <div className="p-4 rounded-2xl bg-emerald-500/20 text-emerald-300 text-xs font-bold text-center">
                Report submitted. Finding you a new partner...
              </div>
            ) : (
              <form onSubmit={handleReportPartner} className="space-y-3">
                <textarea
                  rows={3}
                  required
                  placeholder="Describe the reason (e.g. harassment, inappropriate content)..."
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full p-3 rounded-2xl bg-black/60 border border-slate-800 text-xs text-white focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
                <div className="flex items-center space-x-2">
                  <button
                    type="submit"
                    disabled={reportSubmitting || !reportReason.trim()}
                    className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
                  >
                    {reportSubmitting ? 'Submitting...' : 'Submit Report & Skip'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowReportModal(false)}
                    className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 text-xs font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* LIGHTBOX */}
      {selectedFullImage && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Enlarged photo attachment"
          onClick={() => setSelectedFullImage(null)}
          className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4 cursor-pointer"
        >
          <img
            src={selectedFullImage}
            alt="Full size attachment preview"
            className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl"
          />
        </div>
      )}

      {/* VIP MODAL */}
      <SelfHostedVipModal
        isOpen={showVipModal}
        onClose={() => setShowVipModal(false)}
        reason="photo"
        onSuccess={() => {
          refreshUser();
          setShowVipModal(false);
        }}
      />

      {/* PROFILE SHEET */}
      {showProfileSheet && partner && (
        <ProfilePreviewSheet
          isOpen={showProfileSheet}
          onClose={() => setShowProfileSheet(false)}
          partner={partner}
        />
      )}
    </AppShell>
  );
}
