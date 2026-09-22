'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Sparkles,
} from 'lucide-react';
import Image from 'next/image';
import { useFocusTrap } from '@/hooks/useFocusTrap';

interface ActiveCallData {
  id: string;
  conversationId: string;
  callType: 'VOICE' | 'VIDEO';
  status: 'CALLING' | 'RINGING' | 'ACCEPTED' | 'CONNECTING' | 'CONNECTED' | 'DECLINED' | 'MISSED' | 'ENDED';
  isCaller: boolean;
  isIncoming: boolean;
  startedAt: string;
  offerSdp?: string | null;
  answerSdp?: string | null;
  otherUser: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    avatarEmoji: string;
  };
}

interface CallModalProps {
  onCallEnded?: () => void;
}

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export default function CallModal({ onCallEnded }: CallModalProps) {
  const [activeCall, setActiveCall] = useState<ActiveCallData | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoDisabled, setIsVideoDisabled] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<string>('Calling...');

  // WebRTC refs
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const durationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const candidateQueueRef = useRef<any[]>([]);

  // Sound generator helper for incoming call ringtone
  const audioContextRef = useRef<AudioContext | null>(null);
  const ringOscillatorRef = useRef<OscillatorNode | null>(null);

  const startRingingTone = () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      ringOscillatorRef.current = osc;
    } catch (e) {}
  };

  const stopRingingTone = () => {
    try {
      ringOscillatorRef.current?.stop();
      ringOscillatorRef.current?.disconnect();
      ringOscillatorRef.current = null;
    } catch (e) {}
  };

  // 1. Poll for active calls
  useEffect(() => {
    const checkActiveCall = async () => {
      try {
        const res = await fetch('/api/social/call/active');
        if (!res.ok) return;
        const data = await res.json();
        const call: ActiveCallData | null = data.activeCall;

        if (!call) {
          if (activeCall) {
            handleCleanUp();
            setActiveCall(null);
          }
          return;
        }

        // If incoming call just arrived
        if (call.isIncoming && !activeCall) {
          startRingingTone();
        }

        setActiveCall(call);

        // If call was declined, missed, or ended on server
        if (['ENDED', 'DECLINED', 'MISSED'].includes(call.status)) {
          handleCleanUp();
          setActiveCall(null);
          onCallEnded?.();
        }
      } catch (e) {}
    };

    checkActiveCall();
    pollIntervalRef.current = setInterval(checkActiveCall, 1800);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [activeCall, onCallEnded]);

  // 2. Manage Call Duration Timer
  useEffect(() => {
    if (activeCall?.status === 'CONNECTED' || connectionStatus === 'Connected') {
      durationTimerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
      setCallDuration(0);
    }

    return () => {
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    };
  }, [activeCall?.status, connectionStatus]);

  // 3. WebRTC Negotiation Loop for caller & receiver
  useEffect(() => {
    if (!activeCall) return;

    // Caller signaling poll
    let signalPoll: NodeJS.Timeout | null = null;

    if (activeCall.isCaller && ['CALLING', 'RINGING'].includes(activeCall.status)) {
      signalPoll = setInterval(async () => {
        try {
          const res = await fetch(`/api/social/call/${activeCall.id}/signal`);
          if (!res.ok) return;
          const data = await res.json();

          if (data.status === 'RINGING') {
            setConnectionStatus('Ringing...');
          }

          if (data.status === 'ACCEPTED' && data.answerSdp && peerConnectionRef.current) {
            const pc = peerConnectionRef.current;
            if (pc.signalingState === 'have-local-offer') {
              await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: data.answerSdp }));
              setConnectionStatus('Connected');

              // Flush queued candidates
              while (candidateQueueRef.current.length > 0) {
                const c = candidateQueueRef.current.shift();
                await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
              }
            }
          }

          // Process remote ICE candidates
          if (Array.isArray(data.candidates) && peerConnectionRef.current) {
            const pc = peerConnectionRef.current;
            for (const cand of data.candidates) {
              if (pc.remoteDescription) {
                await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
              } else {
                candidateQueueRef.current.push(cand);
              }
            }
          }
        } catch (e) {}
      }, 1000);
    }

    return () => {
      if (signalPoll) clearInterval(signalPoll);
    };
  }, [activeCall]);

  // Clean up WebRTC tracks and timers
  const handleCleanUp = () => {
    stopRingingTone();
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    setCallDuration(0);
    setConnectionStatus('Calling...');
  };

  // 4. Accept Call
  const handleAcceptCall = async () => {
    if (!activeCall) return;
    stopRingingTone();
    setConnectionStatus('Connecting...');

    try {
      // 1. Get user media
      const isVideo = activeCall.callType === 'VIDEO';
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: isVideo ? { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' } : false,
      });

      localStreamRef.current = stream;
      if (localVideoRef.current && isVideo) {
        localVideoRef.current.srcObject = stream;
      }

      // 2. Initialize PeerConnection
      const pc = new RTCPeerConnection(ICE_SERVERS);
      peerConnectionRef.current = pc;

      // Add local tracks
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      // Handle remote tracks
      pc.ontrack = (event) => {
        if (isVideo && remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        } else if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = event.streams[0];
        }
      };

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          fetch(`/api/social/call/${activeCall.id}/ice`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ candidate: event.candidate }),
          }).catch(() => {});
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          setConnectionStatus('Connected');
        } else if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) {
          handleEndCall();
        }
      };

      // 3. Set remote offer
      if (activeCall.offerSdp) {
        await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: activeCall.offerSdp }));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        // Send answer to server
        await fetch(`/api/social/call/${activeCall.id}/accept`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answerSdp: answer.sdp }),
        });

        setConnectionStatus('Connected');
      }
    } catch (err) {
      console.error('Failed to accept call:', err);
      alert('Unable to access microphone/camera. Please check browser permissions.');
      handleDeclineCall();
    }
  };

  // 5. Decline Call
  const handleDeclineCall = async () => {
    if (!activeCall) return;
    stopRingingTone();
    try {
      await fetch(`/api/social/call/${activeCall.id}/decline`, { method: 'POST' });
    } catch (e) {}
    handleCleanUp();
    setActiveCall(null);
    onCallEnded?.();
  };

  // 6. End Call
  const handleEndCall = async () => {
    if (!activeCall) return;
    try {
      await fetch(`/api/social/call/${activeCall.id}/end`, { method: 'POST' });
    } catch (e) {}
    handleCleanUp();
    setActiveCall(null);
    onCallEnded?.();
  };

  const callModalRef = useRef<HTMLDivElement>(null);
  // Trap keyboard focus & enable Escape key dismissal (BUG-007)
  useFocusTrap(callModalRef, Boolean(activeCall), handleEndCall);

  // Toggle Mute
  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  // Toggle Video
  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoDisabled(!videoTrack.enabled);
      }
    }
  };

  if (!activeCall) return null;

  const isVideo = activeCall.callType === 'VIDEO';
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remaining = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remaining.toString().padStart(2, '0')}`;
  };

  return (
    <div
      ref={callModalRef}
      role="dialog"
      aria-modal="true"
      aria-label={isVideo ? 'VIP Video Call' : 'VIP Voice Call'}
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex flex-col items-center justify-between p-6 animate-in fade-in duration-200"
    >
      {/* Hidden Audio element for remote voice */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      {/* Top Bar */}
      <div className="w-full max-w-lg flex items-center justify-between z-20">
        <div className="flex items-center space-x-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-xs font-black uppercase tracking-wider text-slate-300">
            {isVideo ? 'VIP Video Call' : 'VIP Voice Call'}
          </span>
        </div>

        <div className="px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs font-mono font-bold text-pink-300">
          {callDuration > 0 ? formatTime(callDuration) : connectionStatus}
        </div>
      </div>

      {/* Video Viewport (If Video Call) */}
      {isVideo && (
        <div className="relative w-full max-w-2xl h-[55vh] sm:h-[65vh] rounded-3xl overflow-hidden bg-slate-950 border border-white/10 shadow-2xl flex items-center justify-center">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />

          {/* Picture-in-picture local preview */}
          <div className="absolute top-4 right-4 w-28 sm:w-36 h-36 sm:h-48 rounded-2xl overflow-hidden border-2 border-pink-500 shadow-xl bg-black/80 z-20">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${isVideoDisabled ? 'hidden' : ''}`}
            />
            {isVideoDisabled && (
              <div className="w-full h-full flex items-center justify-center text-xs font-bold text-slate-400">
                Camera off
              </div>
            )}
          </div>
        </div>
      )}

      {/* Voice Avatar Viewport (If Voice Call or Pre-Connect) */}
      {(!isVideo || activeCall.isIncoming) && (
        <div className="flex-1 flex flex-col items-center justify-center space-y-6 z-20 my-auto">
          <div className="relative">
            <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full bg-gradient-to-tr from-pink-600 to-purple-600 p-1.5 shadow-2xl shadow-pink-500/30 animate-pulse">
              <div className="w-full h-full rounded-full bg-slate-950 overflow-hidden flex items-center justify-center">
                {activeCall.otherUser.avatarUrl ? (
                  <img
                    src={activeCall.otherUser.avatarUrl}
                    alt={`Profile picture for ${activeCall.otherUser.username}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-5xl">{activeCall.otherUser.avatarEmoji || '😊'}</span>
                )}
              </div>
            </div>
            <div className="absolute -bottom-2 right-2 px-2.5 py-0.5 rounded-full bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 text-[10px] font-extrabold tracking-wider uppercase flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5" />
              <span>VIP</span>
            </div>
          </div>

          <div className="text-center space-y-1">
            <h3 className="text-2xl font-black text-white">
              {activeCall.otherUser.displayName || `@${activeCall.otherUser.username}`}
            </h3>
            <p className="text-sm font-bold text-pink-400">
              @{activeCall.otherUser.username}
            </p>
            <p className="text-xs text-slate-400">
              {activeCall.isIncoming ? 'Incoming call from friend...' : connectionStatus}
            </p>
          </div>
        </div>
      )}

      {/* Action Controls Bar */}
      <div className="w-full max-w-md flex items-center justify-center gap-6 z-20 pb-4">
        {/* If incoming call and waiting for acceptance */}
        {activeCall.isIncoming && activeCall.status === 'CALLING' ? (
          <div className="flex items-center gap-8 animate-bounce">
            <button
              onClick={handleDeclineCall}
              className="w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-600/40 cursor-pointer active:scale-95 transition-all"
              title="Decline"
            >
              <PhoneOff className="w-7 h-7" />
            </button>

            <button
              onClick={handleAcceptCall}
              className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white flex items-center justify-center shadow-lg shadow-emerald-500/40 cursor-pointer active:scale-95 transition-all"
              title="Accept"
            >
              <Phone className="w-7 h-7" />
            </button>
          </div>
        ) : (
          /* Active Call Controls */
          <div className="flex items-center gap-4 bg-white/5 border border-white/10 px-6 py-3 rounded-full backdrop-blur-md shadow-2xl">
            {/* Mute Toggle */}
            <button
              onClick={toggleMute}
              className={`p-3.5 rounded-full transition-all cursor-pointer ${
                isMuted ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            {/* Camera Toggle (Only for Video calls) */}
            {isVideo && (
              <button
                onClick={toggleVideo}
                className={`p-3.5 rounded-full transition-all cursor-pointer ${
                  isVideoDisabled ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
                title={isVideoDisabled ? 'Turn Camera On' : 'Turn Camera Off'}
              >
                {isVideoDisabled ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
              </button>
            )}

            {/* End Call Button */}
            <button
              onClick={handleEndCall}
              className="px-6 py-3.5 rounded-full bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-rose-600/30 cursor-pointer active:scale-95 transition-all"
            >
              <PhoneOff className="w-4 h-4" />
              <span>End</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
