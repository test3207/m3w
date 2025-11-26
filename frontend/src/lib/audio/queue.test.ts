import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { PlayQueue, RepeatMode } from './queue';
import type { Track } from './player';

const createTrack = (id: string, overrides: Partial<Track> = {}): Track => ({
  id,
  title: `Track ${id}`,
  audioUrl: `https://example.com/${id}.mp3`,
  ...overrides,
});

describe('PlayQueue', () => {
  let queue: PlayQueue;
  let tracks: Track[];

  beforeEach(() => {
    queue = new PlayQueue();
    tracks = [
      createTrack('track-1'),
      createTrack('track-2'),
      createTrack('track-3'),
    ];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes queue with provided tracks and start index', () => {
    queue.setQueue(tracks, 1);

    const state = queue.getState();

    expect(state.tracks).toEqual(tracks);
    expect(state.originalOrder).toEqual(tracks);
    expect(state.currentIndex).toBe(1);
    expect(queue.getCurrentTrack()).toEqual(tracks[1]);
  });

  it('advances through tracks without repeat enabled', () => {
    queue.setQueue(tracks, 0);

    expect(queue.getCurrentTrack()).toEqual(tracks[0]);

    expect(queue.next()).toEqual(tracks[1]);
    expect(queue.getState().currentIndex).toBe(1);

    expect(queue.next()).toEqual(tracks[2]);
    expect(queue.getState().currentIndex).toBe(2);

    expect(queue.next()).toBeNull();
    expect(queue.getState().currentIndex).toBe(2);
  });

  it('loops to the beginning when repeat all is enabled', () => {
    queue.setQueue(tracks, 0);
    queue.jumpTo(tracks[2].id);
    queue.setRepeatMode(RepeatMode.ALL);

    expect(queue.next()).toEqual(tracks[0]);
    expect(queue.getState().currentIndex).toBe(0);
  });

  it('keeps the same track when repeat one is enabled', () => {
    queue.setQueue(tracks, 0);
    queue.jumpTo(tracks[1].id);
    queue.setRepeatMode(RepeatMode.ONE);

    expect(queue.next()).toEqual(tracks[1]);
    expect(queue.getState().currentIndex).toBe(1);
  });

  it('shuffles track order while keeping the current track fixed', () => {
    queue.setQueue(tracks, 1);
    const currentTrack = queue.getCurrentTrack();

    const mathRandomSpy = vi.spyOn(Math, 'random').mockImplementation(() => 0.6);
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

  it('removes tracks and adjusts the current index', () => {
    queue.setQueue(tracks, 2);

    queue.removeTrack('track-2');

    const state = queue.getState();
    expect(state.tracks.map(track => track.id)).toEqual(['track-1', 'track-3']);
    expect(state.currentIndex).toBe(1);
    expect(queue.getCurrentTrack()).toEqual(tracks[2]);
  });

  it('allows explicit shuffle state setting', () => {
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

  it('clears the queue and resets state', () => {
    queue.setQueue(tracks, 0);
    queue.clear();

    const state = queue.getState();
    expect(state.tracks).toEqual([]);
    expect(state.originalOrder).toEqual([]);
    expect(state.currentIndex).toBe(-1);
    expect(queue.getCurrentTrack()).toBeNull();
  });
});
