import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  isMediaSessionSupported,
  updateMediaSessionMetadata,
  updateMediaSessionPlaybackState,
  updateMediaSessionPositionState,
  registerMediaSessionHandlers,
  clearMediaSessionMetadata,
} from "./media-session";

// Mock navigator.mediaSession
const mockSetPositionState = vi.fn();
const mockSetActionHandler = vi.fn();

const createMockMediaSession = () => ({
  metadata: null as MediaMetadata | null,
  playbackState: "none" as MediaSessionPlaybackState,
  setPositionState: mockSetPositionState,
  setActionHandler: mockSetActionHandler,
});

describe("media-session", () => {
  let originalMediaSession: MediaSession | undefined;
  let mockMediaSession: ReturnType<typeof createMockMediaSession>;

  beforeEach(() => {
    // Save original
    originalMediaSession = navigator.mediaSession;

    // Create mock
    mockMediaSession = createMockMediaSession();
    Object.defineProperty(navigator, "mediaSession", {
      value: mockMediaSession,
      writable: true,
      configurable: true,
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore original
    if (originalMediaSession !== undefined) {
      Object.defineProperty(navigator, "mediaSession", {
        value: originalMediaSession,
        writable: true,
        configurable: true,
      });
    }
  });

  describe("isMediaSessionSupported", () => {
    it("returns true when mediaSession is available", () => {
      expect(isMediaSessionSupported()).toBe(true);
    });

    // Note: In browser environment (vitest-browser), we cannot truly remove mediaSession
    // The function is tested implicitly by verifying it doesn't throw when mediaSession exists
  });

  describe("updateMediaSessionMetadata", () => {
    it("sets metadata with all fields", () => {
      updateMediaSessionMetadata({
        title: "Test Song",
        artist: "Test Artist",
        album: "Test Album",
        coverUrl: "https://example.com/cover.jpg",
        duration: 180,
      });

      expect(mockMediaSession.metadata).toBeInstanceOf(MediaMetadata);
      expect(mockMediaSession.metadata?.title).toBe("Test Song");
      expect(mockMediaSession.metadata?.artist).toBe("Test Artist");
      expect(mockMediaSession.metadata?.album).toBe("Test Album");
      expect(mockMediaSession.metadata?.artwork.length).toBeGreaterThan(0);
    });

    it("sets empty strings for missing artist and album", () => {
      updateMediaSessionMetadata({
        title: "Test Song",
      });

      expect(mockMediaSession.metadata?.artist).toBe("");
      expect(mockMediaSession.metadata?.album).toBe("");
    });

    it("sets empty artwork array when no coverUrl provided", () => {
      updateMediaSessionMetadata({
        title: "Test Song",
      });

      expect(mockMediaSession.metadata?.artwork).toEqual([]);
    });
  });

  describe("updateMediaSessionPlaybackState", () => {
    it("sets playback state to playing", () => {
      updateMediaSessionPlaybackState("playing");
      expect(mockMediaSession.playbackState).toBe("playing");
    });

    it("sets playback state to paused", () => {
      updateMediaSessionPlaybackState("paused");
      expect(mockMediaSession.playbackState).toBe("paused");
    });

    it("sets playback state to none", () => {
      updateMediaSessionPlaybackState("none");
      expect(mockMediaSession.playbackState).toBe("none");
    });
  });

  describe("updateMediaSessionPositionState", () => {
    it("calls setPositionState with valid inputs", () => {
      updateMediaSessionPositionState(30, 180);

      expect(mockSetPositionState).toHaveBeenCalledWith({
        duration: 180,
        playbackRate: 1,
        position: 30,
      });
    });

    it("clamps position to valid range", () => {
      // Position greater than duration
      updateMediaSessionPositionState(200, 180);
      expect(mockSetPositionState).toHaveBeenCalledWith({
        duration: 180,
        playbackRate: 1,
        position: 180, // Clamped to duration
      });

      mockSetPositionState.mockClear();

      // Negative position
      updateMediaSessionPositionState(-10, 180);
      expect(mockSetPositionState).toHaveBeenCalledWith({
        duration: 180,
        playbackRate: 1,
        position: 0, // Clamped to 0
      });
    });

    it("does not call setPositionState with NaN duration", () => {
      updateMediaSessionPositionState(30, NaN);
      expect(mockSetPositionState).not.toHaveBeenCalled();
    });

    it("does not call setPositionState with NaN position", () => {
      updateMediaSessionPositionState(NaN, 180);
      expect(mockSetPositionState).not.toHaveBeenCalled();
    });

    it("does not call setPositionState with Infinity duration", () => {
      updateMediaSessionPositionState(30, Infinity);
      expect(mockSetPositionState).not.toHaveBeenCalled();
    });

    it("does not call setPositionState with negative duration", () => {
      updateMediaSessionPositionState(30, -100);
      expect(mockSetPositionState).not.toHaveBeenCalled();
    });

    it("does not call setPositionState with zero duration", () => {
      updateMediaSessionPositionState(30, 0);
      expect(mockSetPositionState).not.toHaveBeenCalled();
    });

    it("accepts custom playbackRate", () => {
      updateMediaSessionPositionState(30, 180, 1.5);

      expect(mockSetPositionState).toHaveBeenCalledWith({
        duration: 180,
        playbackRate: 1.5,
        position: 30,
      });
    });
  });

  describe("clearMediaSessionMetadata", () => {
    it("clears metadata and sets playback state to none", () => {
      // Set initial state
      mockMediaSession.metadata = new MediaMetadata({ title: "Test" });
      mockMediaSession.playbackState = "playing";

      clearMediaSessionMetadata();

      expect(mockMediaSession.metadata).toBeNull();
      expect(mockMediaSession.playbackState).toBe("none");
    });

    it("clears position state", () => {
      clearMediaSessionMetadata();

      // setPositionState should be called without arguments to clear
      expect(mockSetPositionState).toHaveBeenCalledWith();
    });

    it("handles setPositionState error gracefully", () => {
      mockSetPositionState.mockImplementation(() => {
        throw new Error("Not supported");
      });

      // Should not throw
      expect(() => clearMediaSessionMetadata()).not.toThrow();
    });
  });

  describe("registerMediaSessionHandlers", () => {
    it("registers play handler", () => {
      const onPlay = vi.fn();
      registerMediaSessionHandlers({ onPlay });

      expect(mockSetActionHandler).toHaveBeenCalledWith("play", expect.any(Function));
    });

    it("registers pause handler", () => {
      const onPause = vi.fn();
      registerMediaSessionHandlers({ onPause });

      expect(mockSetActionHandler).toHaveBeenCalledWith("pause", expect.any(Function));
    });

    it("registers previoustrack handler", () => {
      const onPreviousTrack = vi.fn();
      registerMediaSessionHandlers({ onPreviousTrack });

      expect(mockSetActionHandler).toHaveBeenCalledWith("previoustrack", expect.any(Function));
    });

    it("registers nexttrack handler", () => {
      const onNextTrack = vi.fn();
      registerMediaSessionHandlers({ onNextTrack });

      expect(mockSetActionHandler).toHaveBeenCalledWith("nexttrack", expect.any(Function));
    });

    it("registers seekto handler", () => {
      const onSeekTo = vi.fn();
      registerMediaSessionHandlers({ onSeekTo });

      expect(mockSetActionHandler).toHaveBeenCalledWith("seekto", expect.any(Function));
    });

    it("registers seekbackward handler", () => {
      const onSeekBackward = vi.fn();
      registerMediaSessionHandlers({ onSeekBackward });

      expect(mockSetActionHandler).toHaveBeenCalledWith("seekbackward", expect.any(Function));
    });

    it("registers seekforward handler", () => {
      const onSeekForward = vi.fn();
      registerMediaSessionHandlers({ onSeekForward });

      expect(mockSetActionHandler).toHaveBeenCalledWith("seekforward", expect.any(Function));
    });

    it("only registers provided handlers", () => {
      registerMediaSessionHandlers({ onPlay: vi.fn() });

      // Should only register play, not others
      const registeredActions = mockSetActionHandler.mock.calls.map((call) => call[0]);
      expect(registeredActions).toEqual(["play"]);
    });

    it("invokes seekto callback with seekTime", () => {
      const onSeekTo = vi.fn();
      registerMediaSessionHandlers({ onSeekTo });

      // Get the registered handler
      const seekToCall = mockSetActionHandler.mock.calls.find((call) => call[0] === "seekto");
      const handler = seekToCall?.[1] as (details: MediaSessionActionDetails) => void;

      // Invoke with valid seekTime
      handler({ action: "seekto", seekTime: 45 });
      expect(onSeekTo).toHaveBeenCalledWith(45);
    });

    it("does not invoke seekto callback with invalid seekTime", () => {
      const onSeekTo = vi.fn();
      registerMediaSessionHandlers({ onSeekTo });

      const seekToCall = mockSetActionHandler.mock.calls.find((call) => call[0] === "seekto");
      const handler = seekToCall?.[1] as (details: MediaSessionActionDetails) => void;

      // NaN
      handler({ action: "seekto", seekTime: NaN });
      expect(onSeekTo).not.toHaveBeenCalled();

      // Negative
      handler({ action: "seekto", seekTime: -10 });
      expect(onSeekTo).not.toHaveBeenCalled();

      // Infinity
      handler({ action: "seekto", seekTime: Infinity });
      expect(onSeekTo).not.toHaveBeenCalled();
    });

    it("invokes seekbackward callback with offset", () => {
      const onSeekBackward = vi.fn();
      registerMediaSessionHandlers({ onSeekBackward });

      const seekBackwardCall = mockSetActionHandler.mock.calls.find(
        (call) => call[0] === "seekbackward"
      );
      const handler = seekBackwardCall?.[1] as (details: MediaSessionActionDetails) => void;

      // With custom offset
      handler({ action: "seekbackward", seekOffset: 15 });
      expect(onSeekBackward).toHaveBeenCalledWith(15);
    });

    it("uses DEFAULT_SEEK_OFFSET when seekOffset is undefined", () => {
      const onSeekBackward = vi.fn();
      registerMediaSessionHandlers({ onSeekBackward });

      const seekBackwardCall = mockSetActionHandler.mock.calls.find(
        (call) => call[0] === "seekbackward"
      );
      const handler = seekBackwardCall?.[1] as (details: MediaSessionActionDetails) => void;

      // Undefined offset should use DEFAULT_SEEK_OFFSET (10)
      handler({ action: "seekbackward", seekOffset: undefined });
      expect(onSeekBackward).toHaveBeenCalledWith(10);
    });

    it("does not invoke seekbackward callback with invalid offset", () => {
      const onSeekBackward = vi.fn();
      registerMediaSessionHandlers({ onSeekBackward });

      const seekBackwardCall = mockSetActionHandler.mock.calls.find(
        (call) => call[0] === "seekbackward"
      );
      const handler = seekBackwardCall?.[1] as (details: MediaSessionActionDetails) => void;

      // NaN offset
      handler({ action: "seekbackward", seekOffset: NaN });
      expect(onSeekBackward).not.toHaveBeenCalled();

      // Negative offset
      handler({ action: "seekbackward", seekOffset: -5 });
      expect(onSeekBackward).not.toHaveBeenCalled();

      // Zero offset
      handler({ action: "seekbackward", seekOffset: 0 });
      expect(onSeekBackward).not.toHaveBeenCalled();
    });

    it("invokes seekforward callback with offset", () => {
      const onSeekForward = vi.fn();
      registerMediaSessionHandlers({ onSeekForward });

      const seekForwardCall = mockSetActionHandler.mock.calls.find(
        (call) => call[0] === "seekforward"
      );
      const handler = seekForwardCall?.[1] as (details: MediaSessionActionDetails) => void;

      // With custom offset
      handler({ action: "seekforward", seekOffset: 30 });
      expect(onSeekForward).toHaveBeenCalledWith(30);
    });

    it("uses DEFAULT_SEEK_OFFSET when seekOffset is undefined for forward", () => {
      const onSeekForward = vi.fn();
      registerMediaSessionHandlers({ onSeekForward });

      const seekForwardCall = mockSetActionHandler.mock.calls.find(
        (call) => call[0] === "seekforward"
      );
      const handler = seekForwardCall?.[1] as (details: MediaSessionActionDetails) => void;

      // Undefined offset should use DEFAULT_SEEK_OFFSET (10)
      handler({ action: "seekforward", seekOffset: undefined });
      expect(onSeekForward).toHaveBeenCalledWith(10);
    });

    it("does not invoke seekforward callback with invalid offset", () => {
      const onSeekForward = vi.fn();
      registerMediaSessionHandlers({ onSeekForward });

      const seekForwardCall = mockSetActionHandler.mock.calls.find(
        (call) => call[0] === "seekforward"
      );
      const handler = seekForwardCall?.[1] as (details: MediaSessionActionDetails) => void;

      // NaN offset
      handler({ action: "seekforward", seekOffset: NaN });
      expect(onSeekForward).not.toHaveBeenCalled();

      // Negative offset
      handler({ action: "seekforward", seekOffset: -5 });
      expect(onSeekForward).not.toHaveBeenCalled();

      // Zero offset
      handler({ action: "seekforward", seekOffset: 0 });
      expect(onSeekForward).not.toHaveBeenCalled();
    });
  });
});
