/**
 * Simple event bus for cross-component communication
 */

type EventCallback = () => void;

class EventBus {
  private listeners: Map<string, Set<EventCallback>> = new Map();

  on(event: string, callback: EventCallback): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    console.log(`[EventBus] Registered listener for event: ${event}. Total listeners: ${this.listeners.get(event)?.size}`);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(callback);
      console.log(`[EventBus] Unregistered listener for event: ${event}. Remaining: ${this.listeners.get(event)?.size}`);
    };
  }

  emit(event: string): void {
    console.log(`[EventBus] Emitting event: ${event}`);
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
} as const;
