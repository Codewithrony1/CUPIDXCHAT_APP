'use client';

import React from 'react';

interface UserAvatarProps {
  user?: {
    username?: string;
    membershipTier?: string;
    profile?: {
      avatarType?: string;
      avatarEmoji?: string;
      avatarUrl?: string | null;
    } | null;
    subscription?: {
      isActive?: boolean;
      plan?: string;
    } | null;
  } | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  alt?: string;
}

function UserAvatarComponent({ user, size = 'md', className = '', alt }: UserAvatarProps) {
  const isVIP = user?.membershipTier === 'VIP' || (user?.subscription?.isActive === true && user?.subscription?.plan === 'VIP');
  const isImageAvatar = isVIP && user?.profile?.avatarType === 'IMAGE' && user?.profile?.avatarUrl;
  const avatarEmoji = user?.profile?.avatarEmoji || '😊';
  const resolvedAlt = alt || (user?.username ? `Profile picture for ${user.username}` : 'User avatar');

  const sizeClasses = {
    sm: 'w-8 h-8 text-base rounded-xl',
    md: 'w-10 h-10 text-xl rounded-2xl',
    lg: 'w-14 h-14 text-3xl rounded-2xl',
    xl: 'w-24 h-24 text-5xl rounded-3xl',
  };

  if (isImageAvatar) {
    return (
      <img
        src={user.profile!.avatarUrl!}
        alt={resolvedAlt}
        className={`${sizeClasses[size]} object-cover border border-pink-400/50 shadow-md ${className}`}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={resolvedAlt}
      className={`${sizeClasses[size]} bg-gradient-to-tr from-pink-600/30 via-purple-600/30 to-rose-600/30 border border-pink-400/50 flex items-center justify-center select-none shadow-md ${className}`}
    >
      {avatarEmoji}
    </div>
  );
}

const UserAvatar = React.memo(UserAvatarComponent);
export default UserAvatar;
