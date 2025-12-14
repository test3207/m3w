/**
 * EventBus Tests
 *
 * Tests for the cross-component event communication system
 */

import { describe, it, expect, vi } from "vitest";
import { eventBus, EVENTS } from "./events";

describe("EventBus", () => {
  describe("on", () => {
    it("should register a listener for an event", () => {
      const callback = vi.fn();
      eventBus.on("test:event", callback);

      eventBus.emit("test:event");

      expect(callback).toHaveBeenCalledOnce();
    });

    it("should pass payload to listener", () => {
      const callback = vi.fn();
      const payload = { data: "test-data" };
      eventBus.on("test:payload", callback);

      eventBus.emit("test:payload", payload);

      expect(callback).toHaveBeenCalledWith(payload);
    });

    it("should support multiple listeners for same event", () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      eventBus.on("test:multi", callback1);
      eventBus.on("test:multi", callback2);

      eventBus.emit("test:multi");

      expect(callback1).toHaveBeenCalledOnce();
      expect(callback2).toHaveBeenCalledOnce();
    });

    it("should return unsubscribe function", () => {
      const callback = vi.fn();
      const unsubscribe = eventBus.on("test:unsub", callback);

      eventBus.emit("test:unsub");
      expect(callback).toHaveBeenCalledOnce();

      unsubscribe();

      eventBus.emit("test:unsub");
      expect(callback).toHaveBeenCalledOnce(); // Still only once
    });
  });

  describe("emit", () => {
    it("should do nothing if no listeners registered", () => {
      // Should not throw
      expect(() => {
        eventBus.emit("nonexistent:event");
      }).not.toThrow();
    });

    it("should emit event without payload", () => {
      const callback = vi.fn();
      eventBus.on("test:nopayload", callback);

      eventBus.emit("test:nopayload");

      expect(callback).toHaveBeenCalledWith(undefined);
    });

    it("should emit event with typed payload", () => {
      const callback = vi.fn();
      const payload = { libraryId: "lib-123" };
      eventBus.on("song:cached", callback);

      eventBus.emit("song:cached", payload);

      expect(callback).toHaveBeenCalledWith(payload);
    });
  });

  describe("off", () => {
    it("should remove a specific listener", () => {
      const callback = vi.fn();
      eventBus.on("test:off", callback);

      eventBus.emit("test:off");
      expect(callback).toHaveBeenCalledOnce();

      eventBus.off("test:off", callback);

      eventBus.emit("test:off");
      expect(callback).toHaveBeenCalledOnce(); // Still only once
    });

    it("should not affect other listeners when removing one", () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      eventBus.on("test:partial", callback1);
      eventBus.on("test:partial", callback2);

      eventBus.off("test:partial", callback1);

      eventBus.emit("test:partial");

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalledOnce();
    });

    it("should do nothing if listener not found", () => {
      const callback = vi.fn();
      // Should not throw
      expect(() => {
        eventBus.off("test:notfound", callback);
      }).not.toThrow();
    });
  });

  describe("EVENTS constants", () => {
    it("should have SONG_DELETED event", () => {
      expect(EVENTS.SONG_DELETED).toBe("song:deleted");
    });

    it("should have SONG_UPLOADED event", () => {
      expect(EVENTS.SONG_UPLOADED).toBe("song:uploaded");
    });

    it("should have SONG_CACHED event", () => {
      expect(EVENTS.SONG_CACHED).toBe("song:cached");
    });
  });

  describe("integration scenarios", () => {
    it("should support component lifecycle pattern", () => {
      // Simulate component mount
      const onSongDeleted = vi.fn();
      const unsubscribe = eventBus.on(EVENTS.SONG_DELETED, onSongDeleted);

      // Some action triggers event
      eventBus.emit(EVENTS.SONG_DELETED, { songId: "song-1" });
      expect(onSongDeleted).toHaveBeenCalledWith({ songId: "song-1" });

      // Component unmount - cleanup
      unsubscribe();

      // Event no longer received
      eventBus.emit(EVENTS.SONG_DELETED, { songId: "song-2" });
      expect(onSongDeleted).toHaveBeenCalledOnce();
    });

    it("should handle multiple subscriptions and unsubscriptions", () => {
      const callbacks: Array<() => void> = [];
      const unsubscribes: Array<() => void> = [];

      // Subscribe 3 listeners
      for (let i = 0; i < 3; i++) {
        const cb = vi.fn();
        callbacks.push(cb);
        unsubscribes.push(eventBus.on("test:batch", cb));
      }

      // Emit - all should receive
      eventBus.emit("test:batch");
      callbacks.forEach((cb) => expect(cb).toHaveBeenCalledOnce());

      // Unsubscribe all
      unsubscribes.forEach((unsub) => unsub());

      // Emit again - none should receive
      eventBus.emit("test:batch");
      callbacks.forEach((cb) => expect(cb).toHaveBeenCalledOnce());
    });

    it("should isolate different event types", () => {
      const songCallback = vi.fn();
      const libraryCallback = vi.fn();

      eventBus.on("song:event", songCallback);
      eventBus.on("library:event", libraryCallback);

      eventBus.emit("song:event");

      expect(songCallback).toHaveBeenCalledOnce();
      expect(libraryCallback).not.toHaveBeenCalled();
    });
  });
});
