/**
 * Simple event bus for cross-component communication
 */

import { logger } from '@/lib/logger-client';

type EventCallback = () => void;

class EventBus {
  private listeners: Map<string, Set<EventCallback>> = new Map();

  on(event: string, callback: EventCallback): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    logger.debug(`[EventBus] Registered listener for event: ${event}. Total listeners: ${this.listeners.get(event)?.size}`);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(callback);
      logger.debug(`[EventBus] Unregistered listener for event: ${event}. Remaining: ${this.listeners.get(event)?.size}`);
    };
  }

  emit(event: string): void {
    logger.debug(`[EventBus] Emitting event: ${event}`);
    this.listeners.get(event)?.forEach((callback) => callback());
  }

  off(event: string, callback: EventCallback): void {
    this.listeners.get(event)?.delete(callback);
  }
}

export const eventBus = new EventBus();

// Event names
export const EVENTS = {
  SONG_DELETED: 'song:deleted',
  SONG_UPLOADED: 'song:uploaded',
  SONG_CACHED: 'song:cached',
} as const;
