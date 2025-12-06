/**
 * Full Player Constants
 * Configuration values for gestures, animations, and transforms
 */

// ============================================================================
// Gesture Configuration
// ============================================================================

/** Gesture configuration for swipe and drag interactions */
export const GESTURE_CONFIG = {
  /** Minimum swipe distance to trigger close (pixels) */
  SWIPE_THRESHOLD: 100,
  /** Drag resistance factor (0-1, lower = more resistance) */
  DRAG_RESISTANCE: 0.6,
  /** Maximum drag distance for opacity calculation (pixels) */
  MAX_DRAG_FOR_OPACITY: 200,
  /** Minimum opacity during drag */
  MIN_DRAG_OPACITY: 0.5,
} as const;

// ============================================================================
// Animation Configuration
// ============================================================================

/** Animation timing and easing configuration */
export const ANIMATION_CONFIG = {
  /** Duration of enter/exit animations (milliseconds) */
  DURATION_MS: 300,
  /** CSS easing function */
  EASING: "ease-out",
} as const;

// ============================================================================
// CSS Transform Values
// ============================================================================

/** CSS transform values for animation states */
export const TRANSFORM = {
  /** Initial position (off-screen bottom) */
  ENTER_START: "translateY(100%)",
  /** Visible position (on-screen) */
  VISIBLE: "translateY(0)",
  /** Exit position for downward swipe */
  EXIT_DOWN: "translateY(100%)",
  /** Exit position for rightward swipe */
  EXIT_RIGHT: "translateX(100%)",
} as const;
