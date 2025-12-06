/**
 * Full Player Types and Animation State Machine
 */

// ============================================================================
// Animation State Machine
// ============================================================================

/** Animation phase */
export enum AnimationPhase {
  Hidden = "hidden",
  Entering = "entering",
  Visible = "visible",
  Exiting = "exiting",
}

/** Exit direction */
export enum ExitDirection {
  Down = "down",
  Right = "right",
}

/** Animation action types */
export enum AnimationActionType {
  Open = "OPEN",
  OpenComplete = "OPEN_COMPLETE",
  Close = "CLOSE",
  CloseComplete = "CLOSE_COMPLETE",
}

/** Animation action union type */
export type AnimationAction =
  | { type: AnimationActionType.Open }
  | { type: AnimationActionType.OpenComplete }
  | { type: AnimationActionType.Close; direction: ExitDirection }
  | { type: AnimationActionType.CloseComplete };

/** Animation state */
export interface AnimationState {
  phase: AnimationPhase;
  exitDirection: ExitDirection;
}

/**
 * Animation state machine reducer
 * 
 * State transitions:
 * - Hidden → (OPEN) → Entering → (OPEN_COMPLETE) → Visible
 * - Visible → (CLOSE) → Exiting → (CLOSE_COMPLETE) → Hidden
 */
export function animationReducer(state: AnimationState, action: AnimationAction): AnimationState {
  switch (action.type) {
    case AnimationActionType.Open:
      return state.phase === AnimationPhase.Hidden || state.phase === AnimationPhase.Exiting
        ? { ...state, phase: AnimationPhase.Entering }
        : state;
    case AnimationActionType.OpenComplete:
      return state.phase === AnimationPhase.Entering
        ? { ...state, phase: AnimationPhase.Visible }
        : state;
    case AnimationActionType.Close:
      return state.phase === AnimationPhase.Visible || state.phase === AnimationPhase.Entering
        ? { phase: AnimationPhase.Exiting, exitDirection: action.direction }
        : state;
    case AnimationActionType.CloseComplete:
      return state.phase === AnimationPhase.Exiting
        ? { ...state, phase: AnimationPhase.Hidden }
        : state;
    default:
      return state;
  }
}
