/**
 * Play Queue Manager
 * 
 * Manages playlist queue, shuffle, repeat modes
 */

import { Track } from "./player";
import { RepeatMode } from "@m3w/shared";

// Re-export RepeatMode for convenience
export { RepeatMode };

export interface QueueState {
  tracks: Track[];
  currentIndex: number;
  shuffleEnabled: boolean;
  repeatMode: RepeatMode;
  originalOrder: Track[];
}

export class PlayQueue {
  private tracks: Track[] = [];
  private currentIndex: number = -1;
  private shuffleEnabled: boolean = false;
  private repeatMode: RepeatMode = RepeatMode.Off;
  private originalOrder: Track[] = [];
  private shuffleOrder: number[] = [];

  /**
   * Set the queue with new tracks
   */
  setQueue(tracks: Track[], startIndex: number = 0): void {
    this.tracks = [...tracks];
    this.originalOrder = [...tracks];
    this.currentIndex = startIndex;

    if (this.shuffleEnabled) {
      this.generateShuffleOrder();
    }
  }

  /**
   * Add track to queue
   */
  addTrack(track: Track, position?: number): void {
    if (position !== undefined) {
      this.tracks.splice(position, 0, track);
      this.originalOrder.splice(position, 0, track);
    } else {
      this.tracks.push(track);
      this.originalOrder.push(track);
    }

    if (this.shuffleEnabled) {
      this.generateShuffleOrder();
    }
  }

  /**
   * Remove track from queue
   */
  removeTrack(trackId: string): void {
    const index = this.tracks.findIndex(t => t.id === trackId);
    if (index === -1) return;

    this.tracks.splice(index, 1);
    this.originalOrder = this.originalOrder.filter(t => t.id !== trackId);

    // Adjust current index if needed
    if (index < this.currentIndex) {
      this.currentIndex--;
    } else if (index === this.currentIndex && this.currentIndex >= this.tracks.length) {
      this.currentIndex = this.tracks.length - 1;
    }

    if (this.shuffleEnabled) {
      this.generateShuffleOrder();
    }
  }

  /**
   * Get current track
   */
  getCurrentTrack(): Track | null {
    if (this.currentIndex < 0 || this.currentIndex >= this.tracks.length) {
      return null;
    }
    return this.tracks[this.currentIndex];
  }

  /**
   * Get next track (considering shuffle and repeat)
   */
  getNextTrack(): Track | null {
    if (this.tracks.length === 0) return null;

    // Repeat one - return same track
    if (this.repeatMode === RepeatMode.One) {
      return this.getCurrentTrack();
    }

    let nextIndex = this.currentIndex + 1;

    // If at end of queue
    if (nextIndex >= this.tracks.length) {
      // Repeat all - go back to start
      if (this.repeatMode === RepeatMode.All) {
        nextIndex = 0;
      } else {
        // No repeat - no next track
        return null;
      }
    }

    return this.tracks[nextIndex];
  }

  /**
   * Get previous track
   */
  getPreviousTrack(): Track | null {
    if (this.tracks.length === 0) return null;

    let prevIndex = this.currentIndex - 1;

    // If at start of queue
    if (prevIndex < 0) {
      // Wrap to end if repeat is enabled
      if (this.repeatMode === RepeatMode.All) {
        prevIndex = this.tracks.length - 1;
      } else {
        // No repeat - restart current track
        return this.getCurrentTrack();
      }
    }

    return this.tracks[prevIndex];
  }

  /**
   * Move to next track
   */
  next(): Track | null {
    if (this.tracks.length === 0) return null;

    // Repeat one - return same track without changing index
    if (this.repeatMode === RepeatMode.One) {
      return this.getCurrentTrack();
    }

    let nextIndex = this.currentIndex + 1;

    // If at end of queue
    if (nextIndex >= this.tracks.length) {
      // Repeat all - go back to start
      if (this.repeatMode === RepeatMode.All) {
        nextIndex = 0;
      } else {
        // No repeat - no next track
        return null;
      }
    }

    this.currentIndex = nextIndex;
    return this.tracks[nextIndex];
  }

  /**
   * Move to previous track
   */
  previous(): Track | null {
    if (this.tracks.length === 0) return null;

    let prevIndex = this.currentIndex - 1;

    // If at start of queue
    if (prevIndex < 0) {
      // Wrap to end if repeat is enabled
      if (this.repeatMode === RepeatMode.All) {
        prevIndex = this.tracks.length - 1;
      } else {
        // No repeat - restart current track (stay at index 0)
        return this.getCurrentTrack();
      }
    }

    this.currentIndex = prevIndex;
    return this.tracks[prevIndex];
  }

  /**
   * Jump to specific track
   */
  jumpTo(trackId: string): Track | null {
    const index = this.tracks.findIndex(t => t.id === trackId);
    if (index === -1) return null;

    this.currentIndex = index;
    return this.tracks[index];
  }

  /**
   * Toggle shuffle mode
   */
  toggleShuffle(): boolean {
    return this.setShuffle(!this.shuffleEnabled);
  }

  setShuffle(enabled: boolean): boolean {
    if (this.shuffleEnabled === enabled) {
      return this.shuffleEnabled;
    }

    const currentTrack = this.getCurrentTrack();
    this.shuffleEnabled = enabled;

    if (this.shuffleEnabled) {
      this.generateShuffleOrder();
      this.applyShuffle();
    } else {
      this.tracks = [...this.originalOrder];

      if (currentTrack) {
        this.currentIndex = this.tracks.findIndex(t => t.id === currentTrack.id);
      } else if (this.tracks.length === 0) {
        this.currentIndex = -1;
      } else {
        this.currentIndex = Math.min(
          Math.max(this.currentIndex, 0),
          this.tracks.length - 1
        );
      }
    }

    return this.shuffleEnabled;
  }

  /**
   * Set repeat mode
   */
  setRepeatMode(mode: RepeatMode): void {
    this.repeatMode = mode;
  }

  /**
   * Cycle through repeat modes
   */
  cycleRepeatMode(): RepeatMode {
    const modes: RepeatMode[] = [RepeatMode.Off, RepeatMode.All, RepeatMode.One];
    const currentIndex = modes.indexOf(this.repeatMode);
    this.repeatMode = modes[(currentIndex + 1) % modes.length];
    return this.repeatMode;
  }

  /**
   * Get queue state
   */
  getState(): QueueState {
    return {
      tracks: [...this.tracks],
      currentIndex: this.currentIndex,
      shuffleEnabled: this.shuffleEnabled,
      repeatMode: this.repeatMode,
      originalOrder: [...this.originalOrder],
    };
  }

  /**
   * Clear queue
   */
  clear(): void {
    this.tracks = [];
    this.originalOrder = [];
    this.currentIndex = -1;
    this.shuffleOrder = [];
  }

  /**
   * Generate shuffle order (Fisher-Yates algorithm)
   */
  private generateShuffleOrder(): void {
    // Create array of indices
    this.shuffleOrder = Array.from({ length: this.originalOrder.length }, (_, i) => i);

    // Standard Fisher-Yates shuffle
    for (let i = this.shuffleOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.shuffleOrder[i], this.shuffleOrder[j]] = [this.shuffleOrder[j], this.shuffleOrder[i]];
    }

    this.applyShuffle();
  }

  /**
   * Apply shuffle order to tracks
   */
  private applyShuffle(): void {
    const currentTrack = this.getCurrentTrack();

    this.tracks = this.shuffleOrder.map(i => this.originalOrder[i]);

    // Update current index
    if (currentTrack) {
      this.currentIndex = this.tracks.findIndex(t => t.id === currentTrack.id);
    }
  }
}

// Singleton instance
let queueInstance: PlayQueue | null = null;

export function getPlayQueue(): PlayQueue {
  if (!queueInstance) {
    queueInstance = new PlayQueue();
  }
  return queueInstance;
}
