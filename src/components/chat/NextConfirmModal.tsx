'use client';

import React, { useState } from 'react';
import { Trash2, ArrowRight } from 'lucide-react';
import BottomSheet from '@/components/ui/BottomSheet';

interface NextConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isNext?: boolean;
}

export default function NextConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  isNext = true,
}: NextConfirmModalProps) {
  const [dontAskAgain, setDontAskAgain] = useState(false);

  const handleConfirm = () => {
    if (dontAskAgain) {
      if (typeof window !== 'undefined') {
        localStorage.setItem('cupidx_skip_next_confirm', 'true');
      }
    }
    onConfirm();
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose}>
      <div className="space-y-5 text-center text-white">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
          <Trash2 className="w-6 h-6" />
        </div>

        <div>
          <h3 className="text-xl font-extrabold tracking-tight text-white">
            {isNext ? 'Start Next Chat?' : 'End Chat Session?'}
          </h3>
          <p className="text-xs text-pink-200/70 mt-1 leading-relaxed max-w-xs mx-auto">
            Your current conversation and all temporary messages will be <strong className="text-rose-400 font-bold">permanently deleted</strong> on the server.
          </p>
        </div>

        <div className="flex items-center space-x-2 text-xs text-pink-300/70 justify-center">
          <input
            type="checkbox"
            id="dontAsk"
            checked={dontAskAgain}
            onChange={(e) => setDontAskAgain(e.target.checked)}
            className="rounded border-pink-300 text-pink-600 focus:ring-pink-500 cursor-pointer"
          />
          <label htmlFor="dontAsk" className="cursor-pointer select-none">
            Don't ask again during this session
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            onClick={onClose}
            className="py-3.5 rounded-2xl bg-white/5 hover:bg-white/10 text-pink-200 font-bold text-xs border border-white/10 transition-all cursor-pointer active:scale-95"
          >
            Keep Chatting
          </button>
          <button
            onClick={handleConfirm}
            className="py-3.5 rounded-2xl bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 text-white font-bold text-xs shadow-lg shadow-pink-500/30 transition-all flex items-center justify-center space-x-1.5 cursor-pointer active:scale-95"
          >
            <span>{isNext ? 'End & Next' : 'End Chat'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
