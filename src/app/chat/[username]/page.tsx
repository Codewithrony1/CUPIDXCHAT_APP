'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import { useChatViewport } from '@/hooks/useChatViewport';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { sanitizeChatText } from '@/lib/sanitizeChatText';
import {
  Send,
  Image as ImageIcon,
  Smile,
  Trash2,
  Flag,
  Ban,
  ArrowLeft,
  Sparkles,
  MoreVertical,
  X,
  AlertCircle,
  MessageSquare,
  User,
  Lock,
  Crown,
  Loader2
} from 'lucide-react';

interface ChatMessage {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  imageUrl: string | null;
  isRead: boolean;
  isDeleted: boolean;
  createdAt: string;
  sender: {
    id: string;
    username: string;
    fullName: string;
  };
}

interface TargetUserProfile {
  id: string;
  username: string;
  fullName: string;
  displayName?: string;
  avatarUrl: string;
  isOnline: boolean;
  isVIP?: boolean;
  bio: string;
  age: number;
  gender: string;
  interests: string;
}

interface DirectChatMessageItemProps {
  msg: ChatMessage;
  isMe: boolean;
  onDeleteMessage: (id: string) => void;
}

const DirectChatMessageItem = React.memo(function DirectChatMessageItem({
  msg,
  isMe,
  onDeleteMessage,
}: DirectChatMessageItemProps) {
  const formattedTime = useMemo(() => {
    try {
      return new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }, [msg.createdAt]);

  return (
    <div
      className={`flex group max-w-[85%] sm:max-w-[70%] flex-col ${
        isMe ? 'self-end items-end' : 'self-start items-start'
      } max-w-full`}
    >
      <div
        className={`relative p-3 sm:p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed overflow-hidden break-words [overflow-wrap:anywhere] [word-break:break-word] min-w-[72px] ${
          isMe
            ? 'bg-gradient-to-tr from-purple-600 to-pink-500 text-white rounded-br-none shadow-md shadow-purple-950/20'
            : 'bg-white/5 border border-white/5 text-slate-100 rounded-bl-none'
        } ${msg.isDeleted ? 'italic text-slate-500 opacity-60' : ''}`}
      >
        {msg.imageUrl && !msg.isDeleted && (
          <img
            src={msg.imageUrl}
            alt="Shared attachment"
            className="rounded-xl max-h-60 object-cover mb-2 border border-black/20 w-full max-w-full"
            loading="lazy"
          />
        )}
        {msg.content && (
          <bdi className="block break-words [overflow-wrap:anywhere] [word-break:break-word] whitespace-pre-wrap leading-relaxed select-text">
            {sanitizeChatText(msg.content)}
          </bdi>
        )}

        {/* Message hover delete trigger */}
        {isMe && !msg.isDeleted && (
          <button
            onClick={() => onDeleteMessage(msg.id)}
            className="absolute top-1 right-1 p-1 rounded bg-black/40 text-pink-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            title="Delete message"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="flex items-center space-x-1.5 mt-1 text-[9px] text-slate-500 px-1 whitespace-nowrap select-none shrink-0">
        <span>{formattedTime}</span>
        {isMe && (
          <span className="shrink-0">
            • {msg.isRead ? <span className="text-purple-400 font-bold">Read</span> : 'Sent'}
          </span>
        )}
      </div>
    </div>
  );
});

export default function ChatWindow() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();

  const targetUsername = params?.username as string;

  // Profile and Message States
  const [targetUser, setTargetUser] = useState<TargetUserProfile | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);

  // Moderation States
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockedByMe, setBlockedByMe] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  // VIP Lock & Profile View States
  const [showVipLockModal, setShowVipLockModal] = useState(false);
  const [showUserProfileModal, setShowUserProfileModal] = useState(false);

  const isVIP = Boolean(
    user?.is_vip ||
    user?.isVIP ||
    user?.membershipTier === 'VIP' ||
    (user?.subscription?.isActive === true && user?.subscription?.plan === 'VIP')
  );

  // Input states
  const [inputText, setInputText] = useState('');
  const [imageFile, setImageFile] = useState<string>('');
  const [isTyping, setIsTyping] = useState(false);
  const [targetUserTyping, setTargetUserTyping] = useState(false);

  // Scroll references
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Dynamic mobile keyboard & visual viewport adaptation (BUG-001)
  const { containerStyle, scrollToBottom } = useChatViewport({ scrollRef: messagesEndRef });

  // Modal focus traps (BUG-007)
  const reportModalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(reportModalRef, showReportModal, () => setShowReportModal(false));

  const profileModalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(profileModalRef, showUserProfileModal, () => setShowUserProfileModal(false));

  const vipLockModalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(vipLockModalRef, showVipLockModal, () => setShowVipLockModal(false));

  // Typing debounce timer
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isCurrentlyTypingRef = useRef(false);

  // Fetch initial history
  const fetchChatHistory = async () => {
    try {
      const res = await fetch(`/api/chat/history?username=${encodeURIComponent(targetUsername)}`);
      if (!res.ok) {
        if (res.status === 404) {
          alert('User not found');
          router.push('/dashboard');
        }
        return;
      }
      const data = await res.json();
      setTargetUser(data.targetUser);
      setMessages(data.messages);
      setIsBlocked(data.isBlocked);
      setBlockedByMe(data.blockedByMe);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (targetUsername) {
      fetchChatHistory();
    }
  }, [targetUsername]);

  useEffect(() => {
    scrollToBottom('auto');
  }, [loading]);

  useEffect(() => {
    scrollToBottom('smooth');
  }, [messages, targetUserTyping]);

  // Socket.IO event registrations
  useEffect(() => {
    if (!socket || !targetUser) return;

    // Join room & Read receipts
    socket.emit('mark_messages_read', { senderId: targetUser.id });

    // Handle new messages
    const handleReceiveMessage = (message: ChatMessage) => {
      if (
        (message.senderId === targetUser.id && message.receiverId === user?.id) ||
        (message.senderId === user?.id && message.receiverId === targetUser.id)
      ) {
        setMessages((prev) => [...prev, message]);

        // If message is from target user, mark as read instantly
        if (message.senderId === targetUser.id) {
          socket.emit('mark_messages_read', { senderId: targetUser.id });
        }
      }
    };

    // Handle online/offline updates
    const handleStatusChange = (data: { userId: string; isOnline: boolean }) => {
      if (data.userId === targetUser.id) {
        setTargetUser((prev) => (prev ? { ...prev, isOnline: data.isOnline } : null));
      }
    };

    // Handle typing indicator
    const handleTypingStatus = (data: { senderId: string; isTyping: boolean }) => {
      if (data.senderId === targetUser.id) {
        setTargetUserTyping(data.isTyping);
      }
    };

    // Handle read receipts
    const handleReadReceipt = (data: { readerId: string }) => {
      if (data.readerId === targetUser.id) {
        setMessages((prev) => prev.map((m) => (m.senderId === user?.id ? { ...m, isRead: true } : m)));
      }
    };

    // Handle deleted messages
    const handleMessageDeleted = (data: { messageId: string; updatedMessage: ChatMessage }) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === data.messageId ? { ...m, content: data.updatedMessage.content, isDeleted: true } : m))
      );
    };

    socket.on('receive_message', handleReceiveMessage);
    socket.on('user_status_changed', handleStatusChange);
    socket.on('typing_status_changed', handleTypingStatus);
    socket.on('messages_read_receipt', handleReadReceipt);
    socket.on('message_deleted', handleMessageDeleted);

    return () => {
      socket.off('receive_message', handleReceiveMessage);
      socket.off('user_status_changed', handleStatusChange);
      socket.off('typing_status_changed', handleTypingStatus);
      socket.off('messages_read_receipt', handleReadReceipt);
      socket.off('message_deleted', handleMessageDeleted);
    };
  }, [socket, targetUser, user]);

  // Handle typing input updates
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);

    if (!socket || !targetUser) return;

    if (!isCurrentlyTypingRef.current) {
      isCurrentlyTypingRef.current = true;
      socket.emit('typing_status', { receiverId: targetUser.id, isTyping: true });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      isCurrentlyTypingRef.current = false;
      socket.emit('typing_status', { receiverId: targetUser.id, isTyping: false });
    }, 2000);
  };

  // Image Upload handler
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) {
        alert('File size exceeds 1MB limit');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageFile(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Send Message trigger
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isVIP) {
      alert('You cannot message this person. Get VIP to chat.');
      return;
    }
    if (!socket || !targetUser || (!inputText.trim() && !imageFile)) return;

    // Clear typing indicator instantly
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    isCurrentlyTypingRef.current = false;
    socket.emit('typing_status', { receiverId: targetUser.id, isTyping: false });

    const payload = {
      receiverId: targetUser.id,
      content: inputText,
      imageUrl: imageFile || null
    };

    socket.emit('send_message', payload, (response: any) => {
      if (response.error) {
        alert(response.error);
      } else {
        setInputText('');
        setImageFile('');
      }
    });
  };

  // Block Action trigger
  const handleBlockUser = async () => {
    if (!targetUser) return;
    if (!isVIP) {
      setShowMenu(false);
      setShowVipLockModal(true);
      return;
    }
    const action = blockedByMe ? 'unblock' : 'block';
    
    if (confirm(`Are you sure you want to ${action} @${targetUser.username}?`)) {
      try {
        const res = await fetch('/api/chat/block', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetUserId: targetUser.id, action })
        });
        if (res.ok) {
          setBlockedByMe(!blockedByMe);
          setIsBlocked(!blockedByMe);
          setShowMenu(false);
        } else if (res.status === 403) {
          setShowMenu(false);
          setShowVipLockModal(true);
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  // Report Action trigger
  const handleReportUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUser || !reportReason.trim()) return;

    setReportSubmitting(true);
    try {
      const res = await fetch('/api/chat/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: targetUser.id, reason: reportReason })
      });
      if (res.ok) {
        alert('User reported successfully.');
        setShowReportModal(false);
        setReportReason('');
        setShowMenu(false);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setReportSubmitting(false);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      const res = await fetch(`/api/chat/message?id=${messageId}`, { method: 'DELETE' });
      if (res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
      }
    } catch (e) {
      console.error('Failed to delete message:', e);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-[#07000e] text-white flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-8 h-8 text-pink-500 animate-spin" />
        <p className="text-xs font-bold text-slate-400">Loading private chat...</p>
      </div>
    );
  }

  if (!targetUser) {
    return null;
  }

  return (
    <div style={containerStyle} className="bg-[#07000e] text-white flex flex-col overflow-hidden font-sans relative">
      {/* Dynamic Background */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-96 bg-gradient-to-b from-pink-600/15 via-purple-600/10 to-transparent blur-3xl pointer-events-none" />

      {/* Top Header */}
      <header className="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-white/5 glass z-20 shrink-0">
        <div className="max-w-4xl mx-auto w-full flex items-center justify-between gap-2">
          <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0 flex-1">
            <Link
              href="/dashboard"
              className="p-2 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>

            <div
              onClick={() => setShowUserProfileModal(true)}
              className="flex items-center space-x-2.5 sm:space-x-3 cursor-pointer group min-w-0 flex-1"
            >
              <div className="relative shrink-0">
                <img
                  src={targetUser.avatarUrl || '/default-avatar.png'}
                  alt={`Profile picture for ${targetUser.fullName || targetUser.username}`}
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover bg-slate-900 border border-pink-500/30 group-hover:border-pink-400 transition-colors"
                />
                {targetUser.isOnline && (
                  <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 border-2 border-slate-950" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <h4 className="text-xs sm:text-sm font-black text-white flex items-center gap-1.5 leading-tight truncate">
                  <span className="truncate">@{targetUser.username}</span>
                  {targetUser.isVIP && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-300 font-extrabold border border-yellow-500/30 flex items-center gap-0.5 shrink-0">
                      <Sparkles className="w-2.5 h-2.5 fill-current" /> VIP
                    </span>
                  )}
                </h4>
                <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium truncate">
                  {targetUserTyping
                    ? 'Typing...'
                    : targetUser.isOnline
                    ? 'Online now'
                    : 'Offline'}
                </p>
              </div>
            </div>
          </div>

          {/* Right Menu Action */}
          <div className="relative shrink-0">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {showMenu && (
              <div className="absolute right-0 mt-2 w-48 rounded-2xl glass-dropdown border border-white/10 p-1.5 shadow-2xl z-50 space-y-1">
                <button
                  onClick={() => {
                    setShowMenu(false);
                    setShowUserProfileModal(true);
                  }}
                  className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/5 transition-all text-left cursor-pointer"
                >
                  <User className="w-4 h-4 text-purple-400" />
                  <span>View Profile</span>
                </button>

                <button
                  onClick={() => {
                    setShowMenu(false);
                    handleBlockUser();
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-pink-400 hover:bg-pink-500/10 transition-all text-left cursor-pointer"
                >
                  <div className="flex items-center space-x-2.5">
                    <Ban className="w-4 h-4" />
                    <span>{blockedByMe ? 'Unblock User' : 'Block User'}</span>
                  </div>
                  {!isVIP && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-300 font-extrabold border border-yellow-500/30 flex items-center gap-0.5">
                      <Lock className="w-2.5 h-2.5" /> VIP
                    </span>
                  )}
                </button>

                <button
                  onClick={() => {
                    setShowReportModal(true);
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-amber-400 hover:bg-amber-500/10 transition-all text-left cursor-pointer"
                >
                  <Flag className="w-4 h-4" />
                  <span>Report User</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Messages Feed */}
      <div className="flex-grow overflow-y-auto overflow-x-hidden p-3 sm:p-6 flex flex-col overscroll-contain" ref={chatContainerRef}>
        <div className="max-w-4xl mx-auto w-full flex-grow flex flex-col space-y-4">
          {messages.length === 0 ? (
            <div className="flex-grow flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-16 h-16 rounded-3xl bg-purple-500/10 flex items-center justify-center text-purple-400">
                <MessageSquare className="w-8 h-8" />
              </div>
              <div>
                <h5 className="text-sm font-bold text-white">Your secure chat with @{targetUser.username}</h5>
                <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1">
                  This dialog is fully monitored. Type a message below to start communicating.
                </p>
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <DirectChatMessageItem
                key={msg.id}
                msg={msg}
                isMe={msg.senderId === user?.id}
                onDeleteMessage={handleDeleteMessage}
              />
            ))
          )}

          {/* Live typing Indicator */}
          {targetUserTyping && (
            <div className="self-start flex items-center space-x-2 bg-white/5 border border-white/5 p-2.5 sm:p-3 rounded-2xl rounded-bl-none text-xs text-slate-400 shrink-0 max-w-[85%]">
              <div className="flex space-x-1 items-center h-2 shrink-0">
                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
              </div>
              <span className="truncate">@{targetUser.username} is typing...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Footer / Input Bar */}
      <footer className="p-3 sm:p-4 md:p-6 pb-[calc(0.6rem+env(safe-area-inset-bottom))] sm:pb-4 md:pb-6 glass border-t border-white/5 shrink-0 z-10">
        <div className="max-w-4xl mx-auto w-full">
          {isBlocked ? (
            <div className="flex items-center justify-center space-x-2 p-3 rounded-2xl bg-pink-500/10 border border-pink-500/20 text-xs text-pink-400 text-center font-medium animate-pulse">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>
                {blockedByMe
                  ? 'You have blocked this user. Unblock them to resume messaging.'
                  : 'You have been blocked from messaging this user.'}
              </span>
            </div>
          ) : !isVIP ? (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 rounded-2xl bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-amber-500/10 border border-pink-500/30">
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
            <form onSubmit={handleSendMessage} className="space-y-3">
              {/* Attachment preview banner */}
              {imageFile && (
                <div className="flex items-center space-x-2 p-2 rounded-xl bg-white/5 border border-white/5 inline-flex relative">
                  <img src={imageFile} alt="Attach Preview" className="w-12 h-12 object-cover rounded-lg" />
                  <button
                    type="button"
                    onClick={() => setImageFile('')}
                    className="absolute -top-1 -right-1 p-0.5 rounded-full bg-slate-900 border border-white/10 text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex gap-1.5 shrink-0">
                  <label className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer">
                    <ImageIcon className="w-5 h-5" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="relative flex-1 min-w-0">
                  <input
                    type="text"
                    placeholder="Type a message spark..."
                    value={inputText}
                    onChange={handleInputChange}
                    className="w-full pl-3.5 sm:pl-4 pr-10 py-2.5 sm:py-3 rounded-2xl glass-input text-[15px] sm:text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setInputText(prev => prev + ' Spark! ✨')}
                    className="absolute right-3 top-3 sm:top-3.5 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    <Smile className="w-4 h-4" />
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={!inputText.trim() && !imageFile}
                  className="p-2.5 sm:p-3 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white transition-all shadow-md active:scale-95 disabled:opacity-40 disabled:pointer-events-none cursor-pointer shrink-0"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </form>
          )}
        </div>
      </footer>

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div
            ref={reportModalRef}
            role="dialog"
            aria-modal="true"
            aria-label="Report User"
            className="w-full max-w-md glass-premium rounded-3xl p-8 space-y-6 relative border border-yellow-500/20"
          >
            <button
              onClick={() => setShowReportModal(false)}
              aria-label="Close dialog"
              className="absolute top-4 right-4 p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-4 text-center">
              <div className="mx-auto w-12 h-12 rounded-xl bg-yellow-500/10 flex items-center justify-center text-yellow-500 border border-yellow-500/30">
                <Flag className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-white">Report User</h3>
                <p className="text-xs text-slate-400">File a report against @{targetUser?.username}</p>
              </div>
            </div>

            <form onSubmit={handleReportUser} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Reason for Report</label>
                <textarea
                  required
                  rows={4}
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  placeholder="Describe the inappropriate behavior, harassment, or violation..."
                  className="w-full px-3 py-2 rounded-xl glass-input text-xs"
                />
              </div>

              <button
                type="submit"
                disabled={reportSubmitting || !reportReason.trim()}
                className="w-full py-3 rounded-xl bg-yellow-600 hover:bg-yellow-500 text-slate-950 font-bold text-sm shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                {reportSubmitting ? 'Submitting Report...' : 'Submit Report'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Public User Profile View Modal */}
      {showUserProfileModal && targetUser && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div
            ref={profileModalRef}
            role="dialog"
            aria-modal="true"
            aria-label={`${targetUser.username}'s Profile`}
            className="w-full max-w-sm glass-premium rounded-3xl p-6 space-y-5 text-center relative border border-pink-500/30 shadow-2xl"
          >
            <button
              onClick={() => setShowUserProfileModal(false)}
              aria-label="Close dialog"
              className="absolute top-4 right-4 p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="relative w-20 h-20 mx-auto">
              <img
                src={targetUser.avatarUrl || '/default-avatar.png'}
                alt={`Profile picture for ${targetUser.fullName || targetUser.username}`}
                className="w-20 h-20 rounded-full object-cover bg-slate-900 border-2 border-pink-400 shadow-lg"
              />
              {targetUser.isOnline && (
                <span className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-emerald-400 border-2 border-slate-950" title="Online" />
              )}
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-center space-x-1.5">
                <h3 className="text-lg font-black text-white">@{targetUser.username}</h3>
                <Crown className="w-4 h-4 text-yellow-400 fill-current" />
              </div>
              <p className="text-xs text-pink-200/70">{targetUser.displayName || targetUser.fullName}</p>
              
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-yellow-500/15 border border-yellow-500/30 text-yellow-300 text-[10px] font-extrabold uppercase mt-1">
                💎 VIP MEMBER
              </span>
            </div>

            {/* Current Mood Display */}
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-xs text-slate-200 font-semibold flex items-center justify-center space-x-2">
              <Smile className="w-4 h-4 text-amber-400" />
              <span>Current Mood: 😎 Attitude</span>
            </div>

            {/* Personality Badges */}
            <div className="space-y-1">
              <span className="text-[10px] font-extrabold text-pink-300 uppercase tracking-wider block">Personality</span>
              <div className="flex flex-wrap justify-center gap-1.5">
                {['💬 Talkative', '😂 Funny', '😊 Friendly'].map((tag) => (
                  <span key={tag} className="px-2.5 py-1 rounded-xl bg-pink-500/15 text-pink-200 text-[11px] font-bold border border-pink-500/30">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setShowUserProfileModal(false)}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-pink-600 to-rose-500 text-white font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
              >
                Chat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Free User VIP Feature Lock Modal */}
      {showVipLockModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div
            ref={vipLockModalRef}
            role="dialog"
            aria-modal="true"
            aria-label="VIP Feature Required"
            className="w-full max-w-sm glass-premium rounded-3xl p-6 space-y-5 text-center relative border border-pink-500/30 shadow-2xl"
          >
            <button
              onClick={() => setShowVipLockModal(false)}
              aria-label="Close dialog"
              className="absolute top-4 right-4 p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-yellow-400 via-amber-500 to-yellow-600 flex items-center justify-center mx-auto text-slate-950 shadow-xl shadow-yellow-500/30 animate-pulse">
              <Crown className="w-7 h-7 fill-current" />
            </div>

            <div className="space-y-2">
              <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-yellow-500/15 border border-yellow-500/30 text-yellow-400 text-[11px] font-extrabold uppercase tracking-wide">
                💎 VIP FEATURE
              </span>
              <h3 className="text-lg font-black text-white">This feature is available with Cupidx VIP.</h3>
              <p className="text-xs text-pink-200/70 leading-relaxed px-2">
                Unlock custom DP uploads, targeted gender discovery, talkative matchmaking & VIP profile badge.
              </p>
            </div>

            <div className="space-y-2 pt-1">
              <Link
                href="/vip"
                onClick={() => setShowVipLockModal(false)}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-yellow-500 via-amber-500 to-yellow-600 hover:from-yellow-400 hover:to-amber-400 text-slate-950 font-black text-xs shadow-lg transition-all active:scale-95 cursor-pointer block text-center"
              >
                EXPLORE VIP
              </Link>

              <button
                onClick={() => setShowVipLockModal(false)}
                className="w-full py-2.5 rounded-2xl text-xs font-bold text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                Maybe later
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
