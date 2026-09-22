'use client';

import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Custom hook to trap keyboard focus within modal dialogs (BUG-007).
 * Ensures WCAG 2.1 compliance by preventing focus escape into background DOM elements
 * and handling Escape key dismissal.
 */
export function useFocusTrap(
  containerRef: React.RefObject<HTMLElement | null>,
  isOpen: boolean,
  onClose?: () => void
) {
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;

    // 1. Remember previously focused element
    if (document.activeElement instanceof HTMLElement) {
      previousActiveElementRef.current = document.activeElement;
    }

    const container = containerRef.current;
    if (!container) return;

    // 2. Focus first focusable element inside the modal
    const focusFirstElement = () => {
      const focusables = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((el) => el.offsetParent !== null && !el.hasAttribute('disabled'));

      if (focusables.length > 0) {
        const autoFocusTarget = focusables.find((el) => el.hasAttribute('data-autofocus'));
        const target = autoFocusTarget || focusables[0];
        target.focus();
      } else {
        container.setAttribute('tabindex', '-1');
        container.focus();
      }
    };

    // Defer slightly to ensure modal animations / transitions mount DOM nodes
    const timer = setTimeout(focusFirstElement, 50);

    // 3. Tab trapping & Escape key listener
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key !== 'Tab') return;

      const focusables = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((el) => el.offsetParent !== null && !el.hasAttribute('disabled'));

      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }

      const firstElement = focusables[0];
      const lastElement = focusables[focusables.length - 1];
      const activeElement = document.activeElement;

      if (e.shiftKey) {
        // Shift + Tab: if on first element or container itself, cycle to last
        if (activeElement === firstElement || activeElement === container) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab: if on last element, cycle to first
        if (activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(timer);
      container.removeEventListener('keydown', handleKeyDown);

      // 4. Restore previous focus upon close
      if (previousActiveElementRef.current && previousActiveElementRef.current.isConnected) {
        previousActiveElementRef.current.focus();
      }
    };
  }, [isOpen, containerRef, onClose]);
}
