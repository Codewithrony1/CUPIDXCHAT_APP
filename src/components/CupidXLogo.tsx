'use client';

import React from 'react';

interface CupidXLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
}

export default function CupidXLogo({
  size = 'md',
  showText = true,
  className = '',
}: CupidXLogoProps) {
  // Sizing definitions
  const dimensions = {
    sm: { box: 'w-8 h-8 rounded-xl', icon: 'w-5 h-5', text: 'text-xl' },
    md: { box: 'w-10 h-10 rounded-2xl', icon: 'w-6 h-6', text: 'text-2xl' },
    lg: { box: 'w-12 h-12 rounded-2xl', icon: 'w-7.5 h-7.5', text: 'text-3xl' },
    xl: { box: 'w-16 h-16 rounded-3xl', icon: 'w-10 h-10', text: 'text-4xl sm:text-5xl' },
  };

  const current = dimensions[size];

  return (
    <div className={`inline-flex items-center space-x-2.5 select-none ${className}`}>
      {/* CupidX Squircle Icon with Heart & Arrow */}
      <div
        className={`${current.box} bg-gradient-to-tr from-[#E024E5] via-[#9D26EC] to-[#6366F1] flex items-center justify-center shadow-lg shadow-fuchsia-500/30 shrink-0 border border-white/20`}
      >
        <svg
          className={`${current.icon} text-white`}
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Heart Outline */}
          <path
            d="M24 39.5C24 39.5 8 28.5 8 18C8 13.5 11.5 10 16 10C19.5 10 22.5 12 24 14.5C25.5 12 28.5 10 32 10C36.5 10 40 13.5 40 18C40 28.5 24 39.5 24 39.5Z"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Cupid Arrow Shaft (Bottom-Left to Top-Right) */}
          <path
            d="M10 38L38 10"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
          />

          {/* Arrowhead at Top-Right */}
          <path
            d="M28 10H38V20"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Arrow Feathers at Bottom-Left */}
          <path
            d="M7 35L13 41"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* Typography: Cupid (White) + X (Hot Pink) */}
      {showText && (
        <span className={`${current.text} font-black tracking-tight flex items-baseline leading-none`}>
          <span className="text-white">Cupid</span>
          <span className="text-[#F43F5E] ml-0.5">X</span>
        </span>
      )}
    </div>
  );
}
