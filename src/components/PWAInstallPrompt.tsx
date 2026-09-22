'use client';

import React, { useState, useEffect } from 'react';
import { Download, X, Heart } from 'lucide-react';

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Only show if user hasn't dismissed it before
      const dismissed = localStorage.getItem('cupidx_pwa_dismissed');
      if (!dismissed) {
        setShowPrompt(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('cupidx_pwa_dismissed', 'true');
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed top-4 left-4 right-4 z-50 max-w-md mx-auto bg-[#180026] text-white rounded-3xl p-4 border border-pink-500/30 shadow-2xl backdrop-blur-xl animate-in slide-in-from-top duration-300 flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pink-600 to-rose-500 flex items-center justify-center text-white shrink-0">
          <Heart className="w-5 h-5 fill-current animate-pulse" />
        </div>
        <div>
          <h4 className="text-xs font-bold text-white">Get the Cupidx App</h4>
          <p className="text-[10px] text-pink-200/70">Add to your home screen for full app experience</p>
        </div>
      </div>

      <div className="flex items-center space-x-2 shrink-0">
        <button
          onClick={handleInstallClick}
          className="px-3 py-1.5 rounded-xl bg-pink-500 hover:bg-pink-600 text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center gap-1 active:scale-95"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Install</span>
        </button>
        <button
          onClick={handleDismiss}
          className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-pink-300 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
