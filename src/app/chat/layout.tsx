'use client';

import React, { useState } from 'react';
import AppShell from '@/components/AppShell';
import SelfHostedVipModal from '@/components/payment/SelfHostedVipModal';
import { useAuth } from '@/context/AuthContext';

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const { user, refreshUser } = useAuth();
  const [showVIPModal, setShowVIPModal] = useState(false);

  return (
    <>
      {children}

      <SelfHostedVipModal
        isOpen={showVIPModal}
        onClose={() => setShowVIPModal(false)}
        onSuccess={() => {
          refreshUser();
          setShowVIPModal(false);
        }}
      />
    </>
  );
}
