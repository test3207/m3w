/**
 * Custom hook for handling long press gestures
 * Uses @use-gesture/react for reliable touch/mouse handling
 * 
 * Features:
 * - Configurable delay (default 500ms, matching iOS/Android)
 * - Cancel on move (10px threshold)
 * - Works with both touch and mouse
 * - Prevents click after long press
 */

import { useGesture } from "@use-gesture/react";
import { useRef, useCallback } from "react";

interface UseLongPressOptions {
  /** Callback when long press is triggered */
  onLongPress: () => void;
  /** Callback for normal click (not long press) */
  onClick?: () => void;
  /** Long press duration in ms (default: 500) */
  delay?: number;
  /** Movement threshold to cancel long press in px (default: 10) */
  threshold?: number;
  /** Whether long press is disabled */
  disabled?: boolean;
}

interface UseLongPressResult {
  /** Bind these to your element */
  bind: ReturnType<typeof useGesture>;
  /** Handler for click events - prevents click after long press */
  handleClick: () => void;
}

// Default values matching native mobile behavior
const DEFAULT_DELAY = 500; // iOS/Android default
const DEFAULT_THRESHOLD = 10; // px

export function useLongPress({
  onLongPress,
  onClick,
  delay = DEFAULT_DELAY,
  threshold = DEFAULT_THRESHOLD,
  disabled = false,
}: UseLongPressOptions): UseLongPressResult {
  // Track if long press was triggered to prevent subsequent click
  const longPressTriggeredRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const startPoint = useRef<{ x: number; y: number } | null>(null);

  const bind = useGesture(
    {
      onPointerDown: ({ event }) => {
        if (disabled) return;
        const e = event as PointerEvent | TouchEvent;
        let x = 0, y = 0;
        if ("touches" in e && e.touches.length > 0) {
          x = e.touches[0].clientX;
          y = e.touches[0].clientY;
        } else if ("clientX" in e) {
          x = (e as PointerEvent).clientX;
          y = (e as PointerEvent).clientY;
        }
        startPoint.current = { x, y };
        timerRef.current = window.setTimeout(() => {
          longPressTriggeredRef.current = true;
          onLongPress();
        }, delay);
      },
      onPointerMove: ({ event }) => {
        if (!timerRef.current || !startPoint.current) return;
        const e = event as PointerEvent | TouchEvent;
        let x = 0, y = 0;
        if ("touches" in e && e.touches.length > 0) {
          x = e.touches[0].clientX;
          y = e.touches[0].clientY;
        } else if ("clientX" in e) {
          x = (e as PointerEvent).clientX;
          y = (e as PointerEvent).clientY;
        }
        const dx = x - startPoint.current!.x;
        const dy = y - startPoint.current!.y;
        if (Math.sqrt(dx * dx + dy * dy) > threshold) {
          // Cancel long press if moved too far
          if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
          }
        }
      },
      onPointerUp: () => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        startPoint.current = null;
      },
      onPointerCancel: () => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        startPoint.current = null;
      },
    },
    {
      eventOptions: { passive: false },
      pointer: { touch: true },
    }
  );

  const handleClick = useCallback(() => {
    if (longPressTriggeredRef.current) {
      // Reset and ignore click after long press
      longPressTriggeredRef.current = false;
      return;
    }
    onClick?.();
  }, [onClick]);

  return { bind, handleClick };
}
