'use client';

import React, { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';

interface HeartItem {
  id: number;
  left: number;
  size: number;
  duration: number;
  delay: number;
  color: string;
}

function FloatingHeartsComponent() {
  const [hearts, setHearts] = useState<HeartItem[]>([]);

  useEffect(() => {
    const generated: HeartItem[] = [];
    const colors = ['text-pink-500', 'text-rose-400', 'text-purple-400', 'text-pink-400'];
    
    for (let i = 0; i < 20; i++) {
      generated.push({
        id: i,
        left: Math.random() * 100, // percentage across screen
        size: Math.floor(Math.random() * 18) + 12, // 12px to 30px
        duration: Math.floor(Math.random() * 8) + 7, // 7s to 15s
        delay: Math.random() * 5, // 0s to 5s delay
        color: colors[Math.floor(Math.random() * colors.length)]
      });
    }
    setHearts(generated);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden -z-5">
      {hearts.map((h) => (
        <div
          key={h.id}
          className={`absolute bottom-0 animate-float-heart ${h.color} opacity-30 fill-current`}
          style={{
            left: `${h.left}%`,
            width: `${h.size}px`,
            height: `${h.size}px`,
            animationDuration: `${h.duration}s`,
            animationDelay: `${h.delay}s`,
          }}
        >
          <Heart className="w-full h-full fill-current" />
        </div>
      ))}
    </div>
  );
}

const FloatingHearts = React.memo(FloatingHeartsComponent);
export default FloatingHearts;
