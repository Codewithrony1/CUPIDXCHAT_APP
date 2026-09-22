'use client';

import React from 'react';
import SelfHostedVipModal from './SelfHostedVipModal';

interface VipQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  defaultPlan?: string;
}

export default function VipQrModal({
  isOpen,
  onClose,
  onSuccess,
}: VipQrModalProps) {
  return (
    <SelfHostedVipModal
      isOpen={isOpen}
      onClose={onClose}
      onSuccess={onSuccess}
    />
  );
}
