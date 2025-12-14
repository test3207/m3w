import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { PlayQueue, RepeatMode } from "./queue";
import type { Track } from "./player";

const createTrack = (id: string, overrides: Partial<Track> = {}): Track => ({
  id,
  title: `Track ${id}`,
  audioUrl: `https://example.com/${id}.mp3`,
  ...overrides,
});

describe("PlayQueue", () => {
  let queue: PlayQueue;
  let tracks: Track[];

  beforeEach(() => {
    queue = new PlayQueue();
    tracks = [
      createTrack("track-1"),
      createTrack("track-2"),
      createTrack("track-3"),
    ];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("initializes queue with provided tracks and start index", () => {
    queue.setQueue(tracks, 1);

    const state = queue.getState();

    expect(state.tracks).toEqual(tracks);
    expect(state.originalOrder).toEqual(tracks);
    expect(state.currentIndex).toBe(1);
    expect(queue.getCurrentTrack()).toEqual(tracks[1]);
  });

  it("advances through tracks without repeat enabled", () => {
    queue.setQueue(tracks, 0);

    expect(queue.getCurrentTrack()).toEqual(tracks[0]);

    expect(queue.next()).toEqual(tracks[1]);
    expect(queue.getState().currentIndex).toBe(1);

    expect(queue.next()).toEqual(tracks[2]);
    expect(queue.getState().currentIndex).toBe(2);

    expect(queue.next()).toBeNull();
    expect(queue.getState().currentIndex).toBe(2);
  });

  it("loops to the beginning when repeat all is enabled", () => {
    queue.setQueue(tracks, 0);
    queue.jumpTo(tracks[2].id);
    queue.setRepeatMode(RepeatMode.All);

    expect(queue.next()).toEqual(tracks[0]);
    expect(queue.getState().currentIndex).toBe(0);
  });

  it("keeps the same track when repeat one is enabled", () => {
    queue.setQueue(tracks, 0);
    queue.jumpTo(tracks[1].id);
    queue.setRepeatMode(RepeatMode.One);

    expect(queue.next()).toEqual(tracks[1]);
    expect(queue.getState().currentIndex).toBe(1);
  });

  it("shuffles track order while keeping the current track fixed", () => {
    queue.setQueue(tracks, 1);
    const currentTrack = queue.getCurrentTrack();

    const mathRandomSpy = vi.spyOn(Math, "random").mockImplementation(() => 0.6);
    mathRandomSpy.mockImplementationOnce(() => 0.2);

    const shuffleEnabled = queue.toggleShuffle();
    expect(shuffleEnabled).toBe(true);

    const state = queue.getState();
    expect(state.shuffleEnabled).toBe(true);
    expect(state.tracks.map(track => track.id)).not.toEqual(tracks.map(track => track.id));
    expect(new Set(state.tracks.map(track => track.id))).toEqual(
      new Set(tracks.map(track => track.id))
    );
    expect(queue.getCurrentTrack()).toEqual(currentTrack);
    expect(state.currentIndex).toBe(
      state.tracks.findIndex(track => track.id === currentTrack?.id)
    );
  });

  it("removes tracks and adjusts the current index", () => {
    queue.setQueue(tracks, 2);

    queue.removeTrack("track-2");

    const state = queue.getState();
    expect(state.tracks.map(track => track.id)).toEqual(["track-1", "track-3"]);
    expect(state.currentIndex).toBe(1);
    expect(queue.getCurrentTrack()).toEqual(tracks[2]);
  });

  it("allows explicit shuffle state setting", () => {
    queue.setQueue(tracks, 0);

    const baselineOrder = queue.getState().tracks.map(track => track.id);

    const enabled = queue.setShuffle(true);
    expect(enabled).toBe(true);
    expect(queue.getState().shuffleEnabled).toBe(true);

    const disabled = queue.setShuffle(false);
    expect(disabled).toBe(false);

    const state = queue.getState();
    expect(state.shuffleEnabled).toBe(false);
    expect(state.tracks.map(track => track.id)).toEqual(baselineOrder);
  });

  it("clears the queue and resets state", () => {
    queue.setQueue(tracks, 0);
    queue.clear();

    const state = queue.getState();
    expect(state.tracks).toEqual([]);
    expect(state.originalOrder).toEqual([]);
    expect(state.currentIndex).toBe(-1);
    expect(queue.getCurrentTrack()).toBeNull();
  });

  describe("previous()", () => {
    it("moves to previous track", () => {
      queue.setQueue(tracks, 2);

      expect(queue.previous()).toEqual(tracks[1]);
      expect(queue.getState().currentIndex).toBe(1);

      expect(queue.previous()).toEqual(tracks[0]);
      expect(queue.getState().currentIndex).toBe(0);
    });

    it("returns current track at start without repeat", () => {
      queue.setQueue(tracks, 0);
      queue.setRepeatMode(RepeatMode.Off);

      // At start, should stay at current track
      const current = queue.getCurrentTrack();
      expect(queue.previous()).toEqual(current);
      expect(queue.getState().currentIndex).toBe(0);
    });

    it("wraps to end when repeat all is enabled", () => {
      queue.setQueue(tracks, 0);
      queue.setRepeatMode(RepeatMode.All);

      expect(queue.previous()).toEqual(tracks[2]);
      expect(queue.getState().currentIndex).toBe(2);
    });

    it("returns null for empty queue", () => {
      expect(queue.previous()).toBeNull();
    });
  });

  describe("addTrack()", () => {
    it("adds track to end of queue", () => {
      queue.setQueue(tracks, 0);
      const newTrack = createTrack("track-4");

      queue.addTrack(newTrack);

      const state = queue.getState();
      expect(state.tracks.length).toBe(4);
      expect(state.tracks[3]).toEqual(newTrack);
    });

    it("adds track at specific position", () => {
      queue.setQueue(tracks, 0);
      const newTrack = createTrack("track-new");

      queue.addTrack(newTrack, 1);

      const state = queue.getState();
      expect(state.tracks.length).toBe(4);
      expect(state.tracks[1]).toEqual(newTrack);
      expect(state.tracks[2]).toEqual(tracks[1]);
    });
  });

  describe("getNextTrack() and getPreviousTrack()", () => {
    it("getNextTrack returns next without changing index", () => {
      queue.setQueue(tracks, 0);

      const next = queue.getNextTrack();
      expect(next).toEqual(tracks[1]);
      expect(queue.getState().currentIndex).toBe(0); // Index unchanged
    });

    it("getPreviousTrack returns previous without changing index", () => {
      queue.setQueue(tracks, 2);

      const prev = queue.getPreviousTrack();
      expect(prev).toEqual(tracks[1]);
      expect(queue.getState().currentIndex).toBe(2); // Index unchanged
    });

    it("getNextTrack returns null at end without repeat", () => {
      queue.setQueue(tracks, 2);
      queue.setRepeatMode(RepeatMode.Off);

      expect(queue.getNextTrack()).toBeNull();
    });

    it("getNextTrack returns first track at end with repeat all", () => {
      queue.setQueue(tracks, 2);
      queue.setRepeatMode(RepeatMode.All);

      expect(queue.getNextTrack()).toEqual(tracks[0]);
    });

    it("getNextTrack returns current track with repeat one", () => {
      queue.setQueue(tracks, 1);
      queue.setRepeatMode(RepeatMode.One);

      expect(queue.getNextTrack()).toEqual(tracks[1]);
    });

    it("getPreviousTrack wraps to end with repeat all at start", () => {
      queue.setQueue(tracks, 0);
      queue.setRepeatMode(RepeatMode.All);

      expect(queue.getPreviousTrack()).toEqual(tracks[2]);
    });

    it("getPreviousTrack returns current at start without repeat", () => {
      queue.setQueue(tracks, 0);
      queue.setRepeatMode(RepeatMode.Off);

      expect(queue.getPreviousTrack()).toEqual(tracks[0]);
    });
  });

  describe("jumpTo()", () => {
    it("jumps to track by id", () => {
      queue.setQueue(tracks, 0);

      const result = queue.jumpTo("track-2");

      expect(result).toEqual(tracks[1]);
      expect(queue.getState().currentIndex).toBe(1);
    });

    it("returns null for non-existent track", () => {
      queue.setQueue(tracks, 0);

      const result = queue.jumpTo("non-existent");

      expect(result).toBeNull();
      expect(queue.getState().currentIndex).toBe(0); // Index unchanged
    });
  });

  describe("removeTrack() edge cases", () => {
    it("does nothing when removing non-existent track", () => {
      queue.setQueue(tracks, 1);

      queue.removeTrack("non-existent");

      expect(queue.getState().tracks.length).toBe(3);
      expect(queue.getState().currentIndex).toBe(1);
    });

    it("adjusts index when removing track before current", () => {
      queue.setQueue(tracks, 2);

      queue.removeTrack("track-1");

      expect(queue.getState().currentIndex).toBe(1); // Was 2, now 1
    });

    it("handles removing last track when at end", () => {
      queue.setQueue(tracks, 2);

      queue.removeTrack("track-3");

      // Index should adjust to stay within bounds
      expect(queue.getState().currentIndex).toBe(1);
    });
  });

  describe("empty queue handling", () => {
    it("getCurrentTrack returns null for empty queue", () => {
      expect(queue.getCurrentTrack()).toBeNull();
    });

    it("getNextTrack returns null for empty queue", () => {
      expect(queue.getNextTrack()).toBeNull();
    });

    it("getPreviousTrack returns null for empty queue", () => {
      expect(queue.getPreviousTrack()).toBeNull();
    });

    it("next returns null for empty queue", () => {
      expect(queue.next()).toBeNull();
    });
  });
});
