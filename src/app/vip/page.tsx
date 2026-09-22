'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { Crown, Loader2 } from 'lucide-react';

export default function VIPPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/premium');
  }, [router]);

  return (
    <AppShell>
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-4 text-center px-4">
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-yellow-400 to-amber-500 flex items-center justify-center shadow-xl shadow-yellow-500/20 animate-pulse">
          <Crown className="w-8 h-8 text-slate-950 fill-current" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-black text-white">Redirecting to CupidX Premium...</h2>
          <p className="text-xs text-slate-400">Loading plans and payment options</p>
        </div>
        <Loader2 className="w-6 h-6 text-pink-500 animate-spin" />
      </div>
    </AppShell>
  );
}
