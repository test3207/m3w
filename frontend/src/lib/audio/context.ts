/**
 * Play Context
 * 
 * Manages the current playback context (library, playlist, or album)
 */

export type PlayContextType = "library" | "playlist" | "album" | "search" | "queue";

export interface PlayContext {
  type: PlayContextType;
  id: string; // library/playlist/album ID
  name: string; // Display name
}

class PlayContextManager {
  private currentContext: PlayContext | null = null;

  /**
   * Set current play context
   */
  setContext(context: PlayContext): void {
    this.currentContext = context;
  }

  /**
   * Get current context
   */
  getContext(): PlayContext | null {
    return this.currentContext;
  }

  /**
   * Clear context
   */
  clearContext(): void {
    this.currentContext = null;
  }

  /**
   * Check if context matches
   */
  isContext(type: PlayContextType, id: string): boolean {
    return (
      this.currentContext?.type === type && this.currentContext?.id === id
    );
  }
}

// Singleton instance
let contextInstance: PlayContextManager | null = null;

export function getPlayContext(): PlayContextManager {
  if (!contextInstance) {
    contextInstance = new PlayContextManager();
  }
  return contextInstance;
}
