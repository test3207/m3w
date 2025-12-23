/**
 * Simple event bus for cross-component communication
 */

import { logger } from "@/lib/logger-client";

// Event payload types
export interface SongCachedPayload {
  libraryId: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EventCallback<T = any> = (payload?: T) => void;

class EventBus {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private listeners: Map<string, Set<EventCallback<any>>> = new Map();

  on<T = void>(event: string, callback: EventCallback<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    logger.debug("[EventBus][on]", `Registered listener for event: ${event}. Total listeners: ${this.listeners.get(event)?.size}`);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(callback);
      logger.debug("[EventBus][on]", `Unregistered listener for event: ${event}. Remaining: ${this.listeners.get(event)?.size}`);
    };
  }

  emit<T = void>(event: string, payload?: T): void {
    logger.debug("[EventBus][emit]", `Emitting event: ${event}`, { raw: payload as Record<string, unknown> });
    this.listeners.get(event)?.forEach((callback) => callback(payload));
  }

  off(event: string, callback: EventCallback): void {
    this.listeners.get(event)?.delete(callback);
  }
}

export const eventBus = new EventBus();

// Event names
export const EVENTS = {
  SONG_DELETED: "song:deleted",
  SONG_UPLOADED: "song:uploaded",
  SONG_CACHED: "song:cached",
} as const;
