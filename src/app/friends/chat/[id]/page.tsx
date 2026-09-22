'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import CallModal from '@/components/social/CallModal';
import { useChatViewport } from '@/hooks/useChatViewport';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { sanitizeChatText } from '@/lib/sanitizeChatText';
import {
  ArrowLeft,
  Phone,
  Video,
  Send,
  Image as ImageIcon,
  MoreVertical,
  Shield,
  Flag,
  Ban,
  Check,
  CheckCheck,
  AlertCircle,
  X,
  Sparkles,
  Lock,
} from 'lucide-react';

interface PartnerInfo {
  id: string;
  username: string;
  hasVipUsername: boolean;
  displayName: string;
  avatarUrl: string | null;
  avatarEmoji: string;
  isOnline: boolean;
}

interface SocialMessage {
  id: string;
  clientMessageId?: string | null;
  conversationId: string;
  senderId: string;
  senderUsername: string;
  senderDisplayName?: string;
  type: 'TEXT' | 'IMAGE' | 'SYSTEM' | 'CALL_EVENT';
  content: string;
  imageUrl?: string | null;
  status: 'SENDING' | 'SENT' | 'FAILED' | 'READ';
  createdAt: string;
}

interface PrivateChatMessageItemProps {
  msg: SocialMessage;
  isMine: boolean;
  onZoomImage: (url: string) => void;
}

const PrivateChatMessageItem = React.memo(function PrivateChatMessageItem({
  msg,
  isMine,
  onZoomImage,
}: PrivateChatMessageItemProps) {
  const formattedTime = useMemo(() => {
    try {
      return new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }, [msg.createdAt]);

  // Call event status pill
  if (msg.type === 'CALL_EVENT') {
    return (
      <div className="flex justify-center my-2">
        <span className="px-3.5 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
          {msg.content}
        </span>
      </div>
    );
  }

  // System notification pill
  if (msg.type === 'SYSTEM') {
    return (
      <div className="flex justify-center my-2">
        <span className="px-3.5 py-1 rounded-full bg-pink-500/10 border border-pink-500/20 text-[11px] font-bold text-pink-300 text-center max-w-xs">
          {msg.content}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
      <div
        className={`min-w-[72px] max-w-[85%] sm:max-w-md rounded-2xl p-3 space-y-1.5 shadow-md ${
          isMine
            ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white rounded-br-none'
            : 'bg-white/10 text-slate-100 rounded-bl-none border border-white/10'
        }`}
      >
        {/* Image message */}
        {msg.imageUrl && (
          <div
            onClick={() => onZoomImage(msg.imageUrl!)}
            className="rounded-xl overflow-hidden cursor-zoom-in max-h-64 bg-black/40 border border-white/10"
          >
            <img src={msg.imageUrl} alt="Attached" className="w-full h-full object-cover" loading="lazy" />
          </div>
        )}

        {/* Text content */}
        {msg.content && (
          <bdi className="block text-xs whitespace-pre-wrap leading-relaxed break-words [overflow-wrap:anywhere] [word-break:break-word]">
            {sanitizeChatText(msg.content)}
          </bdi>
        )}

        {/* Message footer: timestamp + status */}
        <div className="flex items-center justify-end space-x-1 text-[10px] opacity-75 whitespace-nowrap select-none shrink-0">
          <span>{formattedTime}</span>
          {isMine && (
            <span className="shrink-0">
              {msg.status === 'SENDING' ? (
                '⏳'
              ) : msg.status === 'FAILED' ? (
                <AlertCircle className="w-3 h-3 text-rose-300 inline" />
              ) : (
                <Check className="w-3 h-3 text-emerald-300 inline" />
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
});

export default function PrivateChatPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const conversationId = params?.id as string;

  const isVip = Boolean(
    user?.is_vip ||
    user?.isVIP ||
    user?.membershipTier === 'VIP' ||
    (user?.subscription?.isActive === true && user?.subscription?.plan === 'VIP')
  );

  const [partner, setPartner] = useState<PartnerInfo | null>(null);
  const [messages, setMessages] = useState<SocialMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  // Attachment & Zoom
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleZoomImage = useCallback((url: string) => {
    setZoomedImage(url);
  }, []);

  // Options & Moderation
  const [showOptions, setShowOptions] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reportModalRef = useRef<HTMLDivElement>(null);

  // Dynamic mobile keyboard & visual viewport adaptation (BUG-001)
  const { containerStyle, scrollToBottom } = useChatViewport({ scrollRef: messagesEndRef });

  // Focus trap for report dialog (BUG-007)
  useFocusTrap(reportModalRef, showReportModal, () => setShowReportModal(false));

  useEffect(() => {
    scrollToBottom('auto');
  }, [loading]);

  useEffect(() => {
    scrollToBottom('smooth');
  }, [messages.length]);

  const getAuthHeaders = useCallback(() => {
    const headers: Record<string, string> = {};
    if (user?.clerkUserId || user?.id) {
      headers['x-clerk-user-id'] = user.clerkUserId || user.id;
    }
    return headers;
  }, [user]);

  // ─── Real-time Message Sync Loop (650ms cadence) ──────────────────────────
  const syncMessages = useCallback(async () => {
    if (!conversationId) return;

    try {
      const res = await fetch(`/api/social/conversations/${conversationId}/messages`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        if (res.status === 403 || res.status === 404) {
          router.push('/friends');
        }
        return;
      }

      const data = await res.json();
      if (data.partner) {
        setPartner(data.partner);
      }

      if (Array.isArray(data.messages)) {
        setMessages((prev) => {
          // Retain local in-flight SENDING messages that have not yet confirmed
          const pending = prev.filter(
            (local) =>
              local.status === 'SENDING' &&
              !data.messages.some(
                (srv: any) =>
                  (srv.clientMessageId && srv.clientMessageId === local.clientMessageId) ||
                  srv.id === local.id
              )
          );

          const serverMapped: SocialMessage[] = data.messages.map((m: any) => ({
            id: m.id,
            clientMessageId: m.clientMessageId,
            conversationId: m.conversationId,
            senderId: m.senderId,
            senderUsername: m.senderUsername,
            senderDisplayName: m.senderDisplayName,
            type: m.type,
            content: m.content || '',
            imageUrl: m.imageUrl || null,
            status: m.status || 'SENT',
            createdAt: m.createdAt,
          }));

          const combined = [...serverMapped, ...pending];
          combined.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

          const prevSig = prev.map((m) => `${m.id}:${m.status}`).join(',');
          const nextSig = combined.map((m) => `${m.id}:${m.status}`).join(',');
          if (prevSig === nextSig) return prev;

          return combined;
        });
      }
    } catch (e) {
    } finally {
      setLoading(false);
    }
  }, [conversationId, router, getAuthHeaders]);

  useEffect(() => {
    syncMessages();
    syncIntervalRef.current = setInterval(syncMessages, 2000);

    return () => {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    };
  }, [syncMessages]);

  // ─── Send Message ─────────────────────────────────────────────────────────
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isVip) {
      alert('You cannot message this person. Get VIP to chat.');
      return;
    }
    if ((!inputText.trim() && !selectedFile) || sending) return;

    const textToSend = inputText.trim();
    const imageToSend = selectedFile;
    const tempId = `temp_${Date.now()}`;

    const tempMsg: SocialMessage = {
      id: tempId,
      clientMessageId: tempId,
      conversationId,
      senderId: user?.id || 'me',
      senderUsername: user?.vipUsername || user?.username || 'me',
      senderDisplayName: user?.displayName || user?.fullName || 'me',
      type: imageToSend ? 'IMAGE' : 'TEXT',
      content: textToSend,
      imageUrl: imagePreview,
      status: 'SENDING',
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempMsg]);
    setInputText('');
    setSelectedFile(null);
    setImagePreview(null);
    setSending(true);

    try {
      if (imageToSend) {
        const uploadRes = await fetch(`/api/social/conversations/${conversationId}/upload-image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({
            imageData: imageToSend,
            content: textToSend,
          }),
        });

        const uploadData = await uploadRes.json();
        if (uploadRes.ok && uploadData.success) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempId
                ? {
                    ...m,
                    id: uploadData.message?.id || tempId,
                    imageUrl: uploadData.imageUrl,
                    status: 'SENT',
                  }
                : m
            )
          );
          syncMessages();
        } else {
          throw new Error(uploadData.error || 'Failed to upload image.');
        }
      } else {
        const res = await fetch(`/api/social/conversations/${conversationId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({
            content: textToSend,
            clientMessageId: tempId,
          }),
        });

        const data = await res.json();
        if (res.ok && data.success) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempId
                ? {
                    ...m,
                    id: data.message?.id || tempId,
                    status: 'SENT',
                  }
                : m
            )
          );
          syncMessages();
        } else {
          throw new Error(data.error || 'Failed to send message.');
        }
      }
    } catch (err: any) {
      console.error('Send message error:', err);
      alert(err.message || 'Error delivering message.');
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, status: 'FAILED' } : m))
      );
    } finally {
      setSending(false);
    }
  };

  // ─── File Attachment ──────────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type.toLowerCase())) {
      alert('Only image files (JPG, PNG, WEBP, GIF) are allowed.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Image size exceeds 5MB limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUri = event.target?.result as string;
      setSelectedFile(dataUri);
      setImagePreview(dataUri);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // ─── Voice / Video Call Initiation ────────────────────────────────────────
  const handleInitiateCall = async (callType: 'VOICE' | 'VIDEO') => {
    try {
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

      // Clean up temporary setup stream
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
        alert(data.error || 'Failed to place call.');
      }
    } catch (e: any) {
      alert('Camera/microphone access required to place calls.');
    }
  };

  // ─── Block & Report ───────────────────────────────────────────────────────
  const handleBlockUser = async () => {
    if (!partner) return;
    if (!isVip) {
      alert('🔒 Blocking members is an exclusive VIP feature! Please upgrade to CupidX VIP.');
      return;
    }
    if (!confirm(`Are you sure you want to block @${partner.username}?`)) return;

    try {
      const res = await fetch('/api/chat/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ blockedUserId: partner.id }),
      });
      if (res.ok) {
        alert(`@${partner.username} has been blocked.`);
        router.push('/friends');
      } else if (res.status === 403) {
        alert('🔒 CupidX VIP membership required to block members.');
      } else {
        alert('Failed to block member.');
      }
    } catch (e) {
      alert('Failed to block member.');
    }
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partner || !reportReason.trim() || submittingReport) return;

    setSubmittingReport(true);
    try {
      await fetch('/api/chat/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          reportedUserId: partner.id,
          reason: reportReason.trim(),
        }),
      });
      alert('Report submitted to moderators. Thank you for keeping CupidX safe.');
      setShowReportModal(false);
      setReportReason('');
    } catch (e) {
      alert('Failed to file report.');
    } finally {
      setSubmittingReport(false);
    }
  };

  return (
    <div style={containerStyle} className="flex flex-col bg-[#090011] text-white overflow-hidden font-sans">
      {/* Global Call Modal Overlay */}
      <CallModal onCallEnded={syncMessages} />

      {/* Header */}
      <header className="px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-950/70 border-b border-white/10 backdrop-blur-md z-30 shrink-0">
        <div className="max-w-4xl mx-auto w-full flex items-center justify-between gap-2">
          <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0 flex-1">
            <Link
              href="/friends"
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>

            {partner && (
              <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-2xl overflow-hidden bg-slate-900 border border-white/10 shrink-0 flex items-center justify-center">
                  {partner.avatarUrl ? (
                    <img
                      src={partner.avatarUrl}
                      alt={`Profile picture for ${partner.displayName || partner.username}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xl">{partner.avatarEmoji}</span>
                  )}
                  {partner.isOnline && (
                    <span className="absolute bottom-0.5 right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-slate-950" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-bold text-white truncate flex items-center gap-1">
                    <span className="truncate">{partner.displayName}</span>
                    <Sparkles className="w-3 h-3 text-yellow-400 fill-current shrink-0" />
                  </h4>
                  <p className="text-[11px] font-mono font-bold text-pink-400 truncate">@{partner.username}</p>
                </div>
              </div>
            )}
          </div>

          {/* Action Controls */}
          <div className="flex items-center space-x-1.5 shrink-0">
            <button
              onClick={() => handleInitiateCall('VOICE')}
              className="p-2 rounded-xl bg-white/5 hover:bg-emerald-500/20 hover:text-emerald-300 border border-white/10 text-slate-300 transition-all cursor-pointer shrink-0"
              title="Voice Call"
            >
              <Phone className="w-4 h-4" />
            </button>

            <button
              onClick={() => handleInitiateCall('VIDEO')}
              className="p-2 rounded-xl bg-white/5 hover:bg-purple-500/20 hover:text-purple-300 border border-white/10 text-slate-300 transition-all cursor-pointer shrink-0"
              title="Video Call"
            >
              <Video className="w-4 h-4" />
            </button>

            <div className="relative shrink-0">
              <button
                onClick={() => setShowOptions(!showOptions)}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all cursor-pointer"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {showOptions && (
                <div className="absolute right-0 mt-2 w-44 rounded-2xl bg-[#140024] border border-pink-500/30 shadow-2xl p-1.5 z-50 space-y-1 text-xs font-bold animate-in fade-in zoom-in-95 duration-150">
                  <button
                    onClick={() => {
                      setShowOptions(false);
                      setShowReportModal(true);
                    }}
                    className="w-full px-3 py-2 rounded-xl text-left text-slate-300 hover:text-white hover:bg-white/5 flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Flag className="w-3.5 h-3.5 text-amber-400" />
                    <span>Report Member</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowOptions(false);
                      handleBlockUser();
                    }}
                    className="w-full px-3 py-2 rounded-xl text-left text-rose-400 hover:bg-rose-500/10 flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Ban className="w-3.5 h-3.5" />
                      <span>Block Member</span>
                    </div>
                    {!isVip && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-300 font-extrabold border border-yellow-500/30 flex items-center gap-0.5">
                        <Lock className="w-2.5 h-2.5" /> VIP
                      </span>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Messages Feed Area */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 overscroll-contain">
        <div className="max-w-4xl mx-auto w-full flex flex-col space-y-3">
          {loading && (
            <div className="text-center py-12 text-xs text-slate-500 animate-pulse">
              Loading private chat history...
            </div>
          )}

          {messages.map((msg) => (
            <PrivateChatMessageItem
              key={msg.id}
              msg={msg}
              isMine={msg.senderId === user?.id}
              onZoomImage={handleZoomImage}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Image Preview Thumbnail prior to send */}
      {imagePreview && (
        <div className="px-4 py-2 bg-black/40 border-t border-white/10 shrink-0">
          <div className="max-w-4xl mx-auto w-full flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-xl overflow-hidden border border-pink-500/40">
                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
              </div>
              <span className="text-xs text-slate-300">Ready to send photo</span>
            </div>

            <button
              onClick={() => {
                setSelectedFile(null);
                setImagePreview(null);
              }}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Message Composer */}
      <footer className="p-2.5 sm:p-3 pb-[calc(0.6rem+env(safe-area-inset-bottom))] sm:pb-3 bg-slate-950/80 border-t border-white/10 shrink-0 backdrop-blur-md">
        {!isVip ? (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 rounded-2xl bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-amber-500/10 border border-pink-500/30 max-w-4xl mx-auto">
            <div className="flex items-center space-x-2.5 text-xs text-pink-200">
              <AlertCircle className="w-4 h-4 text-pink-400 shrink-0" />
              <span>You cannot message this person. Get VIP to chat.</span>
            </div>
            <Link
              href="/vip"
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-pink-600 via-rose-500 to-amber-500 text-white text-xs font-black tracking-wide shadow-md shadow-pink-500/20 hover:brightness-110 active:scale-95 transition-all text-center whitespace-nowrap"
            >
              Get VIP
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSendMessage} className="flex items-center gap-2 max-w-4xl mx-auto">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-pink-400 border border-white/10 transition-all cursor-pointer shrink-0"
              title="Attach Image"
            >
              <ImageIcon className="w-4 h-4" />
            </button>

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type a private message..."
              maxLength={2000}
              className="flex-1 min-w-0 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-2xl bg-black/50 border border-white/10 text-white text-[15px] sm:text-xs placeholder:text-slate-500 focus:outline-none focus:border-pink-500 transition-all font-sans"
            />

            <button
              type="submit"
              disabled={(!inputText.trim() && !selectedFile) || sending}
              className="p-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 disabled:opacity-40 hover:from-pink-500 hover:to-purple-500 text-white font-bold cursor-pointer shadow-md shadow-pink-500/20 active:scale-95 transition-all shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        )}
      </footer>

      {/* Fullscreen Image Zoom Modal */}
      {zoomedImage && (
        <div
          onClick={() => setZoomedImage(null)}
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out"
        >
          <img src={zoomedImage} alt="Zoomed" className="max-w-full max-h-full rounded-2xl shadow-2xl object-contain" />
        </div>
      )}

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div
            ref={reportModalRef}
            role="dialog"
            aria-modal="true"
            aria-label="Report Member"
            className="w-full max-w-md rounded-3xl bg-[#120021] border border-pink-500/30 p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-white">Report Member</h3>
              <button
                onClick={() => setShowReportModal(false)}
                aria-label="Close dialog"
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Please describe the safety or community guideline violation:
            </p>

            <form onSubmit={handleReportSubmit} className="space-y-4">
              <textarea
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="Inappropriate behavior, harassment, spam..."
                rows={4}
                required
                className="w-full p-3 rounded-2xl bg-black/40 border border-white/10 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-pink-500"
              />

              <div className="flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 text-xs font-bold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submittingReport || !reportReason.trim()}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md shadow-rose-600/20 active:scale-95 transition-all cursor-pointer"
                >
                  {submittingReport ? 'Submitting...' : 'Submit Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
