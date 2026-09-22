'use client';

import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useFocusTrap } from '@/hooks/useFocusTrap';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export default function BottomSheet({
  isOpen,
  onClose,
  title,
  children,
}: BottomSheetProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Trap keyboard focus & enable Escape key dismissal (BUG-007)
  useFocusTrap(containerRef, isOpen, onClose);

  // Lock body scrolling when bottom sheet is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title || 'Dialog'}
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
      />

      {/* Sheet Container */}
      <div
        ref={containerRef}
        className="relative w-full max-w-lg bg-[#180026] text-white rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl border-t sm:border border-pink-500/20 z-10 animate-in slide-in-from-bottom duration-300 max-h-[90vh] overflow-y-auto pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
      >
        {/* Mobile Drag Indicator Bar */}
        <div className="w-12 h-1.5 bg-pink-500/30 rounded-full mx-auto mb-4 cursor-grab sm:hidden" />

        {/* Header */}
        {title && (
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-pink-500/20">
            <h3 className="text-lg font-bold text-white tracking-tight">{title}</h3>
            <button
              onClick={onClose}
              aria-label="Close dialog"
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-pink-300 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Content */}
        {children}
      </div>
    </div>
  );
}
