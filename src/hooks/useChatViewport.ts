'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface UseChatViewportOptions {
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  autoScrollOnKeyboard?: boolean;
}

interface ChatViewportState {
  viewportHeight: number | null;
  keyboardHeight: number;
  isKeyboardOpen: boolean;
  containerStyle: React.CSSProperties;
  scrollToBottom: (behavior?: ScrollBehavior) => void;
}

/**
 * Custom hook to dynamically adapt chat layout to mobile software keyboards (BUG-001).
 * Uses window.visualViewport to detect virtual keyboard expansion, prevents layout shifts,
 * and keeps the composer input anchored above the keyboard.
 */
export function useChatViewport({
  scrollRef,
  autoScrollOnKeyboard = true,
}: UseChatViewportOptions = {}): ChatViewportState {
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState<number>(0);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState<boolean>(false);
  const initialInnerHeightRef = useRef<number>(0);

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = 'smooth') => {
      if (scrollRef?.current) {
        scrollRef.current.scrollIntoView({ behavior, block: 'end' });
      }
    },
    [scrollRef]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    initialInnerHeightRef.current = window.innerHeight;

    const handleViewportChange = () => {
      if (!window.visualViewport) {
        // Fallback for browsers without visualViewport
        setViewportHeight(window.innerHeight);
        setKeyboardHeight(0);
        setIsKeyboardOpen(false);
        return;
      }

      const vv = window.visualViewport;
      const currentHeight = Math.round(vv.height);
      const windowHeight = window.innerHeight;
      const offsetTop = Math.max(0, Math.round(vv.offsetTop || 0));

      // Calculate keyboard occlusion height
      const rawDiff = windowHeight - (currentHeight + offsetTop);
      const calculatedKeyboard = Math.max(0, rawDiff);
      const keyboardActive = calculatedKeyboard > 80;

      setViewportHeight(currentHeight);
      setKeyboardHeight(calculatedKeyboard);
      setIsKeyboardOpen(keyboardActive);

      if (keyboardActive && autoScrollOnKeyboard) {
        // Smoothly bring latest message and input into view
        requestAnimationFrame(() => {
          scrollToBottom('smooth');
        });
      }
    };

    // Initial measurement
    handleViewportChange();

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange);
      window.visualViewport.addEventListener('scroll', handleViewportChange);
    }
    window.addEventListener('resize', handleViewportChange);

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportChange);
        window.visualViewport.removeEventListener('scroll', handleViewportChange);
      }
      window.removeEventListener('resize', handleViewportChange);
    };
  }, [autoScrollOnKeyboard, scrollToBottom]);

  // Compute container style
  const containerStyle: React.CSSProperties = {
    height: viewportHeight ? `${viewportHeight}px` : '100dvh',
    maxHeight: viewportHeight ? `${viewportHeight}px` : '100dvh',
    overflow: 'hidden',
  };

  return {
    viewportHeight,
    keyboardHeight,
    isKeyboardOpen,
    containerStyle,
    scrollToBottom,
  };
}
